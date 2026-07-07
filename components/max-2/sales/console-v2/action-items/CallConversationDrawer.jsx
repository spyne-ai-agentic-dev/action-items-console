'use client'

/**
 * CallConversationDrawer — read-only embed port of the production Call-Logs detail drawer
 * (apps/converse-ai/components/Call-Logs/sidebar.tsx). Mirrors its exact layout, theme
 * (#4600f2 primary, gray scale, purple/green chat avatars, green/orange/red AI scores),
 * sections (Call ID · Key Highlights · Customer Information & Summary · AI Performance ·
 * Appointment · Transcript), waveform player, and transcript click-to-seek.
 *
 * Call mode → end-call report by callId (waveform + rich sections).
 * SMS/chat → inline smsMessages thread (no audio), auto-scrolled to the action-item creation point.
 * Conversation mode lists the customer's conversations and auto-opens the source one.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AiOutlineLoading3Quarters } from 'react-icons/ai'
import { FaArrowLeft, FaBolt, FaCalendar, FaClock, FaCopy, FaFileAlt, FaPlayCircle, FaRegComments, FaTimes, FaUser } from 'react-icons/fa'
import { IoMdCall } from 'react-icons/io'
import { MdOutlineError } from 'react-icons/md'
import { CHANNEL_META, ageLabel, ageMinutes } from './data'
import { fetchCallReport, fetchConversations, recordingProxyUrl } from './be-client'
import { normalizeCallReport } from './be-mapper'
import WaveformPlayer from './WaveformPlayer'

const MESSAGING = new Set(['sms', 'chat'])
const DRAWER_TABS = [
  { id: 'highlights', label: 'Highlights' },
  { id: 'customer', label: 'Customer' },
  { id: 'summary', label: 'Summary' },
  { id: 'appointment', label: 'Appointment' },
  { id: 'transcript', label: 'Transcript' },
]

const fmtClock = (sec) => {
  if (sec == null || isNaN(sec) || sec < 0) return '0:00'
  const s = Math.floor(sec)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const fmtStamp = (ms) => {
  if (!ms) return ''
  const d = new Date(ms)
  if (isNaN(d.getTime())) return ''
  let h = d.getHours()
  const ap = h >= 12 ? 'PM' : 'AM'
  h = h % 12 || 12
  return `${MON[d.getMonth()]} ${d.getDate()}, ${h}:${String(d.getMinutes()).padStart(2, '0')} ${ap}`
}
const getScoreColor = (score) => (score >= 7 ? 'text-green-600' : score >= 5 ? 'text-orange-600' : 'text-red-600')
const roleBadge = (role) => (role === 'agent'
  ? { label: 'AI', bg: 'bg-purple-200', text: 'text-purple-700' }
  : { label: 'CU', bg: 'bg-green-200', text: 'text-green-700' })

function smsTurns(conv) {
  const arr = Array.isArray(conv?.smsMessages) ? [...conv.smsMessages] : []
  arr.sort((a, b) => (Date.parse(a.createdAt || 0) || 0) - (Date.parse(b.createdAt || 0) || 0))
  return arr
    .map((m) => ({ role: m.direction === 'out' ? 'agent' : 'customer', text: m.body || m.message || m.text || '', atSec: null, atMs: m.createdAt ? Date.parse(m.createdAt) : null }))
    .filter((m) => m.text)
}

function SectionHeader({ label, icon: Icon, onCopy, isCopied }) {
  return (
    <h3 className="mb-4 flex items-center justify-between text-sm font-medium text-gray-900">
      <div className="flex items-center gap-2"><Icon className="h-4 w-4 text-gray-700/30" /> {label}</div>
      <button onClick={onCopy} className="h-8 w-8 rounded-md p-0 hover:bg-gray-100" title={isCopied ? 'Copied!' : `Copy ${label.toLowerCase()}`}>
        <FaCopy className={`h-4 w-4 ${isCopied ? 'text-green-500' : 'text-gray-500'}`} />
      </button>
    </h3>
  )
}

/* ── Transcript turns (calls: click-to-seek; SMS: absolute time, no audio) ── */
function TranscriptTurns({ turns, isMessaging, activeIndex, scrollToMs, onSeek, registerRef }) {
  const markerRef = useRef(null)
  const markerIdx = useMemo(() => {
    if (!isMessaging || !scrollToMs) return -1
    let best = -1, bestD = Infinity
    turns.forEach((m, i) => { if (m.atMs) { const d = Math.abs(m.atMs - scrollToMs); if (d < bestD) { bestD = d; best = i } } })
    return best
  }, [turns, scrollToMs, isMessaging])
  useEffect(() => { if (markerIdx >= 0) { const t = setTimeout(() => markerRef.current?.scrollIntoView({ block: 'center' }), 80); return () => clearTimeout(t) } }, [markerIdx])

  if (!turns.length) {
    return (
      <div className="py-8 text-center">
        <FaFileAlt className="mx-auto mb-3 h-12 w-12 text-gray-300" />
        <p className="text-sm text-gray-500">No {isMessaging ? 'conversation' : 'transcript'} available</p>
      </div>
    )
  }
  return (
    <div className="space-y-4">
      {turns.map((m, index) => {
        const b = roleBadge(m.role)
        const isActive = activeIndex === index
        const isMarker = index === markerIdx
        const clickable = !isMessaging && m.atSec != null
        return (
          <div key={index} ref={(el) => { registerRef?.(index, el); if (isMarker) markerRef.current = el }}>
            {isMarker && (
              <div className="mb-3 flex items-center gap-2">
                <span className="h-px flex-1 bg-[#4600f2]" />
                <span className="rounded-full bg-[#4600f2]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#4600f2]">Action item created</span>
                <span className="h-px flex-1 bg-[#4600f2]" />
              </div>
            )}
            <div
              onClick={() => clickable && onSeek?.(m.atSec)}
              className={`overflow-hidden rounded-xl border p-4 transition-all ${clickable ? 'cursor-pointer' : ''} ${
                isActive ? 'border-[#4600f2] bg-[#4600f2]/10 shadow-md ring-2 ring-[#4600f2]/30'
                  : 'border-gray-200 bg-gray-50 ' + (clickable ? 'hover:border-[#4600f2] hover:bg-[#4600f2]/5' : '')
              }`}
              title={clickable ? 'Click to jump to this point in audio' : undefined}
            >
              <div className="flex gap-3">
                <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold ${isActive ? 'bg-[#4600f2] text-white' : `${b.bg} ${b.text}`}`}>{b.label}</div>
                <div className="flex-1">
                  <div className="mb-2 flex items-baseline gap-3">
                    <span className={`font-semibold ${isActive ? 'text-[#4600f2]' : 'text-gray-900'}`}>{m.role === 'agent' ? 'Agent' : 'Customer'}</span>
                    {m.atSec != null
                      ? <span className={`text-xs ${isActive ? 'font-medium text-[#4600f2]' : 'text-[#4600f2]'} hover:underline`}>{fmtClock(m.atSec)}</span>
                      : m.atMs ? <span className="text-xs text-gray-500">{fmtStamp(m.atMs)}</span> : null}
                  </div>
                  <div className={`leading-relaxed ${isActive ? 'text-gray-800' : 'text-gray-700'}`}>{m.text}</div>
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function CallConversationDrawer({ item, mode, onClose }) {
  const isMessaging = MESSAGING.has(item?.source_channel)

  const [activeTab, setActiveTab] = useState('highlights')
  // Open the item's OWN source directly (callSid, else the conversationId — usually a vapi call/
  // report id) for BOTH Listen and Transcript, so we land on the exact call this item came from
  // instead of dumping the customer's whole conversation list.
  const [viewCallId, setViewCallId] = useState(item?.source_call_id || item?.source_conversation_id || null)
  const [smsView, setSmsView] = useState(null)
  const [report, setReport] = useState(null)
  const [reportFailed, setReportFailed] = useState(false)
  const [loadErr, setLoadErr] = useState(null)   // surfaced when a call report can't be loaded
  const [convs, setConvs] = useState(null)
  const [browseList, setBrowseList] = useState(false)   // user opted to browse all conversations
  const [drilledFromList, setDrilledFromList] = useState(false) // opened a call/sms from that list
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(null)
  const [audioTime, setAudioTime] = useState(0)
  const [audioPlaying, setAudioPlaying] = useState(false)

  const waveRef = useRef(null)
  const contentRef = useRef(null)
  const transcriptRefs = useRef(new Map())

  const copy = useCallback((text, section) => {
    try { navigator.clipboard?.writeText(text); setCopied(section); setTimeout(() => setCopied(null), 2000) } catch {}
  }, [])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // Load the customer's other conversations for the optional "Browse all" list (not shown by default).
  useEffect(() => {
    if (mode !== 'conversation' || !item?.customer_id) return
    let cancelled = false
    fetchConversations(item.customer_id)
      .then((r) => { if (!cancelled) setConvs(r.conversations || []) })
      .catch(() => { if (!cancelled) setConvs([]) })
    return () => { cancelled = true }
  }, [mode, item?.customer_id])

  // Resolve the item's REAL call and load its report. Try the item's own call id (callSid), then its
  // conversation id, then (for call items) the customer's most recent call — so Listen/Transcript
  // always lands on the actual call instead of dropping to the evidence snippet. Fall back to the
  // snippet ONLY when no report exists anywhere; surface the last error so a genuine gap is visible.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true); setReportFailed(false); setReport(null); setLoadErr(null)
      const tried = []
      let rep = null, usedId = null, lastErr = null
      const tryId = async (id) => {
        if (!id || tried.includes(id)) return null
        tried.push(id)
        try { const raw = await fetchCallReport(id); const n = raw ? normalizeCallReport(raw) : null; if (n) { usedId = id; return n } }
        catch (e) { lastErr = e }
        return null
      }
      for (const id of [item?.source_call_id, item?.source_conversation_id]) { rep = await tryId(id); if (rep) break }
      // Last resort (call items only): the customer's most recent call from their conversation history.
      if (!rep && !isMessaging && item?.customer_id) {
        try {
          const { conversations } = await fetchConversations(item.customer_id)
          for (const c of (conversations || [])) { rep = await tryId(c.callId || c.call_id || c?.call?.id || c?.vapiCallId); if (rep) break }
        } catch (e) { lastErr = e }
      }
      if (cancelled) return
      setReport(rep); if (usedId) setViewCallId(usedId)
      setReportFailed(!rep); setLoadErr(rep ? null : lastErr); setLoading(false)
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.source_call_id, item?.source_conversation_id, item?.customer_id])

  const messages = report?.messages || []
  const activeTranscriptIndex = useMemo(() => {
    if (!audioPlaying || !messages.length) return -1
    for (let i = messages.length - 1; i >= 0; i--) { if ((messages[i].atSec ?? Infinity) <= audioTime) return i }
    return -1
  }, [audioTime, messages, audioPlaying])

  // Audio playing → keep Transcript tab active + auto-scroll the active turn.
  useEffect(() => { if (audioPlaying) setActiveTab('transcript') }, [audioPlaying])
  useEffect(() => {
    if (activeTranscriptIndex >= 0 && audioPlaying) transcriptRefs.current.get(activeTranscriptIndex)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [activeTranscriptIndex, audioPlaying])

  // Scroll-spy: highlight the tab whose section is in view (mirrors production).
  useEffect(() => {
    if (!viewCallId || loading) return
    const root = contentRef.current
    if (!root) return
    const visible = new Set()
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => { const id = e.target.id.replace('section-', ''); e.isIntersecting ? visible.add(id) : visible.delete(id) })
      requestAnimationFrame(() => {
        if (audioPlaying) { setActiveTab('transcript'); return }
        for (const t of DRAWER_TABS) if (visible.has(t.id)) { setActiveTab(t.id); return }
      })
    }, { root, rootMargin: '-10% 0px -70% 0px', threshold: 0 })
    const els = []
    DRAWER_TABS.forEach((t) => { const el = document.getElementById(`section-${t.id}`); if (el) { obs.observe(el); els.push(el) } })
    return () => { els.forEach((el) => obs.unobserve(el)); obs.disconnect() }
  }, [viewCallId, loading, report, audioPlaying])

  if (typeof document === 'undefined' || !item) return null

  const channel = CHANNEL_META[item.source_channel]
  const evTurns = Array.isArray(item.evidence_turns) ? item.evidence_turns : []
  const showCallDetail = !!viewCallId && !!report && !reportFailed
  const showSms = !!smsView
  // Fallback view (no drillable report/thread): the evidence excerpt by default, the full
  // conversation list only when the user explicitly browses.
  const inConvList = !showCallDetail && !showSms
  const scrollToMs = item.created_at ? Date.parse(item.created_at) : null
  const ageMin = report?.createdAt ? Math.floor((Date.now() - Date.parse(report.createdAt)) / 60000) : ageMinutes(item)
  const drilledIn = drilledFromList && (showCallDetail || showSms)

  // Derived call fields (production mapping).
  const customerName = report?.customerName || item.customer_name || 'Unknown'
  const phoneNumber = report?.customerMobile || 'N/A'
  const highlights = report?.summaryPoints || []
  const callSummary = report?.analysisSummary || report?.summaryText || ''
  const actionItems = report?.actionItems || []
  const q = report?.aiQuality || {}
  const aiScore = parseFloat(q.score) || 0
  const appt = report?.appointment || {}
  const title = report?.title || item.intent_recap || (isMessaging ? 'Conversation' : 'Call received but the customer did not speak')

  const seek = (sec) => { waveRef.current?.seek(sec); waveRef.current?.play() }

  const headerIcon = drilledIn ? null : (isMessaging ? FaRegComments : IoMdCall)

  // One conversation card in the "Browse all" list. Opening one drills in (with a back arrow).
  const renderConvCard = (c) => {
    const isThis = (c.conversationId || c._id || c.callId) === item.source_conversation_id
    const smsCount = Array.isArray(c.smsMessages) ? c.smsMessages.length : 0
    const isSms = c.type === 'sms' || c.type === 'chat' || (!c.callId && smsCount > 0)
    const openable = !!c.callId || smsCount > 0
    return (
      <button key={c.conversationId || c._id} disabled={!openable}
        onClick={() => { setDrilledFromList(true); if (c.callId) setViewCallId(c.callId); else if (smsCount > 0) setSmsView(c) }}
        className={`flex w-full flex-col gap-1 rounded-lg border bg-white p-3 text-left transition-colors hover:border-[#4600f2] disabled:cursor-not-allowed disabled:opacity-50 ${isThis ? 'border-[#4600f2]' : 'border-gray-200'}`}>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">{isSms ? <FaRegComments className="h-3 w-3" /> : <IoMdCall className="h-3 w-3" />} {c.type || (isSms ? 'sms' : 'call')}</span>
          {isThis ? <span className="rounded-full bg-[#4600f2]/10 px-2 py-0.5 text-[10px] font-semibold text-[#4600f2]">this item</span> : null}
          <span className="ml-auto text-[10px] text-gray-400">{c.status}</span>
        </div>
        <span className="text-[13px] font-semibold text-gray-900">{c.callTitle || (isSms ? 'SMS conversation' : 'Conversation')}</span>
        {openable ? <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold text-[#4600f2]">{isSms ? <FaRegComments className="h-3 w-3" /> : <FaPlayCircle className="h-3 w-3" />} Open {isSms ? `conversation${smsCount ? ` · ${smsCount} msgs` : ''}` : 'call'}</span> : <span className="mt-0.5 text-[10px] text-gray-400">No transcript available</span>}
      </button>
    )
  }

  const body = (
    <div className="console-v2-sales-root">
      <div onClick={onClose} className="fixed inset-0 z-[199]" style={{ background: 'rgba(15,23,42,0.45)' }} />
      <div className="fixed right-0 top-0 z-[200] flex h-screen w-[500px] max-w-[96vw] flex-col bg-white shadow-2xl" role="dialog" aria-modal="true" aria-label={isMessaging ? 'Conversation detail' : 'Call detail'}>
        {/* Header */}
        <div className="flex-none border-b border-gray-100 bg-white px-6 pb-5 pt-4">
          <div className="flex items-start gap-3">
            {drilledIn ? (
              <button onClick={() => { setViewCallId(null); setSmsView(null); setReport(null); setReportFailed(true); setDrilledFromList(false); setBrowseList(true); setActiveTab('highlights') }} className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200" title="Back to conversations"><FaArrowLeft className="h-4 w-4" /></button>
            ) : (
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100">{headerIcon && headerIcon === IoMdCall ? <IoMdCall className="h-6 w-6 text-gray-500" /> : <FaRegComments className="h-5 w-5 text-gray-500" />}</div>
            )}
            <div className="min-w-0 flex-1">
              <h1 className="mb-1.5 break-words text-xl font-semibold text-gray-900">{title}</h1>
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <div className="flex items-center gap-2"><FaClock className="h-4 w-4" /> <span>{ageLabel(ageMin)}</span></div>
                {channel ? <span className="text-gray-400">· {channel.label}</span> : null}
              </div>
            </div>
            <button onClick={onClose} className="flex-shrink-0 rounded-lg p-2 text-gray-400 transition-all hover:bg-gray-100 hover:text-gray-600"><FaTimes className="h-5 w-5" /></button>
          </div>
        </div>

        {loading && <div className="flex flex-1 items-center justify-center"><AiOutlineLoading3Quarters className="h-8 w-8 animate-spin text-[#4600f2]" /></div>}
        {error && !loading && <div className="flex flex-1 items-center justify-center px-6 text-center"><p className="text-sm text-gray-500">Couldn’t load detail: {error}</p></div>}

        {/* Fallback view — the item's evidence excerpt (the exchange when it was created) by
            default. The full conversation list only appears when the user chooses to browse, so
            we never dump every call/SMS and leave the user hunting for the source. */}
        {!loading && !error && inConvList && (
          <div className="flex-1 space-y-2 overflow-y-auto bg-gray-50/50 px-6 py-6">
            {browseList ? (
              <>
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{customerName}'s conversations</p>
                  {evTurns.length > 0 && <button onClick={() => setBrowseList(false)} className="text-[11px] font-semibold text-[#4600f2]">← Back to excerpt</button>}
                </div>
                {(convs || []).length === 0 && <p className="text-sm text-gray-500">No conversations found.</p>}
                {(convs || []).map(renderConvCard)}
              </>
            ) : (
              <>
                {loadErr && (
                  <div className="mb-1 rounded-[8px] border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-800">
                    <span className="font-semibold">Couldn’t load the full call report</span> for this item — showing the captured details instead.
                    <span className="mt-1 block font-mono text-[10px] text-amber-700/80">{String(loadErr?.message || loadErr)}</span>
                  </div>
                )}

                {/* NOTE — what this action item is, on top. */}
                <div className="rounded-xl border border-gray-200 bg-white p-3">
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-gray-400">Note</p>
                  <p className="text-[13px] font-semibold leading-relaxed text-gray-900">{item.intent_recap || 'Action item'}</p>
                  {item.source_message && item.source_message !== item.intent_recap && (
                    <p className="mt-1.5 text-[12px] italic leading-relaxed text-gray-600">“{item.source_message}”</p>
                  )}
                </div>

                {/* Exact customer + agent verbatim (when captured on the call). */}
                {evTurns.length > 0 && (
                  <div className="space-y-2">
                    {evTurns.filter((t) => t.role === 'customer').map((t, i) => (
                      <div key={'c' + i} className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                        <div className="mb-1 flex items-center gap-2"><div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-200 text-[10px] font-semibold text-green-700">CU</div><span className="text-[11px] font-semibold text-gray-500">Customer</span></div>
                        <p className="text-[13px] leading-relaxed text-gray-800">{t.text}</p>
                      </div>
                    ))}
                    {evTurns.some((t) => t.role === 'ai') && (
                      <div className="rounded-xl border border-[#4600f2]/20 bg-[#4600f2]/5 p-3">
                        <div className="mb-1 flex items-center gap-2"><div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#4600f2]/15 text-[10px] font-semibold text-[#4600f2]">AG</div><span className="text-[11px] font-semibold uppercase tracking-wide text-[#4600f2]">Agent</span></div>
                        {evTurns.filter((t) => t.role === 'ai').map((t, i) => <p key={'a' + i} className="text-[13px] leading-relaxed text-gray-800">{t.text}</p>)}
                      </div>
                    )}
                  </div>
                )}

                {/* DETAILS — the action item, vertical key/value list. */}
                <div className="rounded-xl border border-gray-200 bg-white p-3">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-gray-400">Details</p>
                  <dl className="flex flex-col gap-2 text-[12.5px]">
                    {[
                      ['Customer', customerName],
                      ['Channel', channel?.label || item.source_channel || '—'],
                      ['Intent', String(item.intent_id || '—').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())],
                      ['Created', ageLabel(ageMin)],
                      ['Status', item.status || '—'],
                      ['Assignee', item.assignee_user_id ? (report?.assigneeName || item.assignee_user_id) : 'Unassigned'],
                    ].map(([k, v]) => (
                      <div key={k} className="flex items-start justify-between gap-3">
                        <dt className="flex-shrink-0 text-gray-500">{k}</dt>
                        <dd className="min-w-0 truncate text-right font-medium text-gray-900">{v}</dd>
                      </div>
                    ))}
                  </dl>
                </div>

                <p className="text-[11px] text-gray-400">{viewCallId ? 'No full transcript stored for this call.' : 'No linked call/transcript for this item.'}</p>
                {(convs || []).length > 0 && <button onClick={() => setBrowseList(true)} className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-[#4600f2]">Browse all {(convs || []).length} conversations →</button>}
              </>
            )}
          </div>
        )}

        {/* SMS / chat thread (no audio, no report sections) */}
        {!loading && !error && smsView && (
          <div className="flex-1 overflow-y-auto bg-gray-50/50 px-6 py-6">
            <SectionHeader label="Conversation" icon={FaRegComments} onCopy={() => copy(smsTurns(smsView).map((t) => `${t.role === 'agent' ? 'Agent' : 'Customer'}: ${t.text}`).join('\n'), 'sms')} isCopied={copied === 'sms'} />
            <TranscriptTurns turns={smsTurns(smsView)} isMessaging scrollToMs={scrollToMs} />
          </div>
        )}

        {/* Call detail — production sections */}
        {!loading && !error && showCallDetail && (
          <>
            <div className="flex-none border-b border-gray-100 bg-white px-6 pb-4">
              {!isMessaging ? (
                report?.recordingUrl ? (
                  <WaveformPlayer key={viewCallId} ref={waveRef} url={recordingProxyUrl(report.recordingUrl)} onTimeUpdate={setAudioTime} onPlay={() => setAudioPlaying(true)} onPause={() => setAudioPlaying(false)} />
                ) : (
                  <div className="mt-3 rounded-[8px] border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-800">
                    <span className="font-semibold">No recording returned by the backend for this call.</span> The report loaded, but <code>callDetails.recordingUrl</code> is empty — the recording wasn’t captured/stored server-side (transcript below is still available).
                    <span className="mt-1 block font-mono text-[10px] text-amber-700/80">callId: {viewCallId}</span>
                  </div>
                )
              ) : null}
            </div>
            <div className="flex-none border-b border-gray-100 bg-white px-6">
              <nav className="flex space-x-3 overflow-x-auto">
                {DRAWER_TABS.map((t) => (
                  <button key={t.id} onClick={() => { setActiveTab(t.id); document.getElementById(`section-${t.id}`)?.scrollIntoView({ behavior: 'smooth' }) }}
                    className={`whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium transition-colors ${activeTab === t.id ? 'border-[#4600f2] text-[#4600f2]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                    {t.id === 'transcript' && isMessaging ? 'Conversation' : t.label}
                  </button>
                ))}
              </nav>
            </div>

            <div ref={contentRef} className="flex-1 space-y-8 overflow-y-auto bg-gray-50/50 px-6 py-6">
              {/* Call ID */}
              <div className="space-y-3">
                <h3 className="mb-4 flex items-center gap-2 text-sm font-medium text-gray-900"><IoMdCall className="h-4 w-4 text-gray-700/30" /> Call ID</h3>
                <div className="flex w-full items-center gap-2 rounded-[8px] bg-gray-100 px-3 py-2 text-xs font-medium text-gray-700" title={viewCallId}>
                  <span className="min-w-0 flex-1 truncate font-mono">{viewCallId}</span>
                  <button type="button" onClick={() => copy(viewCallId, 'callId')} className="flex-shrink-0 rounded p-0.5 transition-colors hover:bg-gray-200" title={copied === 'callId' ? 'Copied!' : 'Copy Call ID'}><FaCopy className={`h-3.5 w-3.5 ${copied === 'callId' ? 'text-green-500' : 'text-gray-500'}`} /></button>
                </div>
              </div>

              {/* Key Highlights */}
              <div id="section-highlights" className="space-y-3">
                <SectionHeader label="Key Highlights" icon={MdOutlineError} onCopy={() => copy(highlights.join('\n'), 'highlights')} isCopied={copied === 'highlights'} />
                <div className="rounded-lg border border-gray-100 bg-gray-50/50 p-5">
                  {highlights.length > 0 ? (
                    <ul className="space-y-4">{highlights.map((h, i) => (
                      <li key={i} className="flex gap-4"><span className="mt-0.5 w-4 flex-shrink-0 text-sm font-medium text-gray-400">{i + 1}.</span><span className="text-sm leading-relaxed text-gray-700">{h}</span></li>
                    ))}</ul>
                  ) : <p className="text-sm text-gray-500">No highlights available</p>}
                </div>
              </div>

              {/* Customer Information & Summary */}
              <div id="section-customer" className="space-y-3">
                <SectionHeader label="Customer Information & Summary" icon={FaUser} onCopy={() => copy(`Customer: ${customerName}\nPhone: ${phoneNumber}\nSummary: ${callSummary}\nAction Items: ${actionItems.join(', ')}`, 'customer')} isCopied={copied === 'customer'} />
                <div className="space-y-6 rounded-lg border border-gray-200 bg-white p-5">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 border-b border-gray-100 pb-2"><FaUser className="h-4 w-4 text-gray-600" /><span className="text-xs font-semibold uppercase tracking-wide text-gray-600">Customer Information</span></div>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#DAEAFE]"><FaUser className="h-4 w-4 text-[#5c97df]" /></div>
                      <div className="flex-1"><div className="mb-1 text-xs font-medium text-gray-500">Customer Name</div><div className="text-sm font-medium text-gray-900">{customerName}</div></div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-green-100"><IoMdCall className="h-4 w-4 text-[#5c97df]" /></div>
                      <div className="flex-1"><div className="mb-1 text-xs font-medium text-gray-500">Phone Number</div><div className="font-mono text-sm text-gray-900">{phoneNumber}</div></div>
                    </div>
                  </div>
                  <div id="section-summary" className="space-y-4">
                    <div className="flex items-center gap-2 border-b border-gray-100 pb-2"><FaFileAlt className="h-4 w-4 text-gray-600" /><span className="text-xs font-semibold uppercase tracking-wide text-gray-600">Summary & Action Items</span></div>
                    <div className="space-y-3">
                      <div className="rounded-lg bg-gray-50 p-4"><div className="mb-2 text-xs font-medium text-gray-500">Call Summary</div><div className="text-sm leading-relaxed text-gray-900">{callSummary || 'No summary available'}</div></div>
                      {actionItems.length > 0 && (
                        <div className="rounded-r-lg border-l-4 border-[#4600f2] bg-[#4600f2]/5 p-4">
                          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#4600f2]">Next Action Required</div>
                          <ul className="space-y-1 text-sm leading-relaxed text-gray-900">{actionItems.map((it, i) => (<li key={i} className="flex items-start gap-2"><span className="mt-0 text-[#4600f2]">•</span><span>{it}</span></li>))}</ul>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* AI Performance Analysis */}
              <div id="section-ai" className="space-y-3">
                <SectionHeader label="AI Performance Analysis" icon={FaBolt} onCopy={() => copy(`AI Score: ${q.score || aiScore}/10\nWhat AI Did Well: ${(q.didWell || []).join(', ') || 'N/A'}\nAreas for Improvement: ${(q.improve || []).join(', ') || 'N/A'}`, 'ai')} isCopied={copied === 'ai'} />
                <div className="rounded-lg border border-gray-200 bg-white p-5">
                  <div className="mb-4 grid grid-cols-2 gap-4">
                    <div><div className="mb-1 text-xs font-medium text-gray-500">Overall Score</div><div className={`text-lg font-semibold ${getScoreColor(aiScore)}`}>{q.score || aiScore} / 10</div></div>
                    {q.relevanceClarity != null && (<div><div className="mb-1 text-xs font-medium text-gray-500">Relevance & Clarity</div><div className="text-lg font-semibold text-green-600">{q.relevanceClarity} / 10</div></div>)}
                  </div>
                  {q.didWell?.length > 0 && (
                    <div className="mb-4 rounded-r-lg border-l-4 border-green-500 bg-green-500/5 p-4">
                      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-green-600">What AI Did Well</div>
                      <ul className="space-y-1">{q.didWell.map((it, i) => (<li key={i} className="flex items-start gap-2 text-sm text-gray-900"><span className="mt-0 text-green-600">•</span><span>{it}</span></li>))}</ul>
                    </div>
                  )}
                  {q.improve?.length > 0 && (
                    <div className="rounded-r-lg border-l-4 border-orange-500 bg-orange-500/5 p-4">
                      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-orange-600">Areas for Improvement</div>
                      <ul className="space-y-1">{q.improve.map((it, i) => (<li key={i} className="flex items-start gap-2 text-sm text-gray-900"><span className="mt-0 text-orange-600">•</span><span>{it}</span></li>))}</ul>
                    </div>
                  )}
                </div>
              </div>

              {/* Appointment */}
              <div id="section-appointment" className="space-y-3">
                <SectionHeader label="Appointment" icon={FaCalendar} onCopy={() => copy(`Appointment Scheduled: ${appt.scheduled ? 'Yes' : 'No'}\nType: ${appt.type || 'N/A'}\nDetails: ${(appt.details || []).join(', ') || 'N/A'}`, 'appointment')} isCopied={copied === 'appointment'} />
                <div className="rounded-lg border border-gray-200 bg-white p-4">
                  {appt.scheduled ? (
                    <div className="grid grid-cols-3 gap-4">
                      <div><div className="mb-1 text-xs font-medium text-gray-500">Type</div><div className="text-sm capitalize text-gray-900">{appt.type || 'N/A'}</div></div>
                      <div><div className="mb-1 text-xs font-medium text-gray-500">Status</div><div className="text-sm font-medium text-green-600">Scheduled</div></div>
                      {appt.details?.length > 0 && (<div><div className="mb-1 text-xs font-medium text-gray-500">Details</div><div className="text-sm text-gray-900">{appt.details[0]}</div></div>)}
                    </div>
                  ) : <div className="py-4 text-center"><p className="text-sm text-gray-500">No appointment scheduled</p></div>}
                </div>
              </div>

              {/* Transcript */}
              <div id="section-transcript" className="space-y-3">
                <SectionHeader label={isMessaging ? 'Conversation' : 'Transcript'} icon={FaFileAlt} onCopy={() => copy(messages.map((m) => `[${fmtClock(m.atSec)}] ${m.role === 'agent' ? 'Agent' : 'Customer'}: ${m.text}`).join('\n'), 'transcript')} isCopied={copied === 'transcript'} />
                <TranscriptTurns turns={messages} isMessaging={isMessaging} activeIndex={activeTranscriptIndex} scrollToMs={isMessaging ? scrollToMs : null} onSeek={seek} registerRef={(i, el) => { if (el) transcriptRefs.current.set(i, el); else transcriptRefs.current.delete(i) }} />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
  return createPortal(body, document.body)
}
