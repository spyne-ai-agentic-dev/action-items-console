'use client';

/**
 * The two overlays: the customer panel and the source call or conversation.
 *
 * Decision rows kept: 30 the customer panel with Open and Resolved history,
 * 33 the Listen overlay reduced to a player plus transcript, 34 open the
 * conversation, 50 the close control.
 *
 * Row 33 explicitly drops the AI score from this overlay. The end-call report
 * still carries one; this surface does not read it. Where the score moves is
 * still an open question for eng, so nothing here pretends to answer it.
 */
import {
  fetchViniCallReportAPI,
  fetchViniCustomerConversationsAPI,
} from '@/services/vini-action-items.service';

import React, { useEffect, useState } from 'react';
import {
  PiArrowSquareOutBold,
  PiCheckCircleBold,
  PiPhoneBold,
  PiPlayCircleBold,
  PiWarningBold,
  PiXBold,
} from 'react-icons/pi';

import {
  CARD,
  EmptyPanel,
  GhostButton,
  IntentBadge,
  SectionLabel,
  cx,
} from './vini-action-items-atoms';
import {
  ViniActionItem,
  ViniActionItemsDepartment,
  ViniCallReport,
  ViniIntentTaxonomy,
  customerLabel,
  formatCount,
  formatTimestamp,
  initialsOf,
  isPastSla,
  mapViniCallReport,
} from './vini-action-items-data';

/* ── Shell ───────────────────────────────────────────────────────── */

const DrawerShell: React.FC<{
  label: string;
  onClose: () => void;
  header: React.ReactNode;
  children: React.ReactNode;
  wide?: boolean;
}> = ({ label, onClose, header, children, wide }) => {
  // Row 50. Escape closes, so a BDC opening this all shift is never trapped.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[200]">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-[#0f172a]/45"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={cx(
          'absolute right-0 top-0 flex h-full w-full max-w-[92vw] flex-col bg-white shadow-2xl',
          wide ? 'sm:w-[640px]' : 'sm:w-[440px]'
        )}
      >
        <div className="flex flex-none items-center gap-2.5 border-b border-[#eceef2] px-4 py-3.5">
          <div className="min-w-0 flex-1">{header}</div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex size-8 flex-none items-center justify-center rounded-lg text-[#98a2b3] hover:bg-[#f1f2f6]"
          >
            <PiXBold size={16} />
          </button>
        </div>
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
          {children}
        </div>
      </div>
    </div>
  );
};

/* ── Customer panel ──────────────────────────────────────────────── */

export type ViniCustomerJump = 'open' | 'resolved' | 'repeat';

/** David, 22-Sep: the three counts are light blue buttons into the queue. */
const StatTile: React.FC<{
  label: string;
  value: number;
  onClick?: () => void;
}> = ({ label, value, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={!onClick}
    className="min-w-0 flex-1 rounded-xl border border-[#b2ddff] bg-[#eff8ff] px-3 py-2 text-left transition-colors hover:bg-[#d1e9ff] disabled:cursor-default disabled:hover:bg-[#eff8ff]"
  >
    <p className="truncate text-[9.5px] font-bold uppercase tracking-wide text-[#175cd3]">
      {label}
    </p>
    <p className="mt-0.5 text-[18px] font-bold tabular-nums text-[#1849a9]">
      {formatCount(value)}
    </p>
  </button>
);

/**
 * Row 30. Everything this page knows about one customer.
 *
 * The counts are over the items this page has loaded, and the header says so.
 * They are not the customer's lifetime totals, because closed history is never
 * fetched. Labelling the denominator beats a number that reads bigger than it is.
 */
export const ViniCustomerPanel: React.FC<{
  customerId: string;
  items: ViniActionItem[];
  taxonomy: ViniIntentTaxonomy;
  onClose: () => void;
  onJump?: (target: ViniCustomerJump, customerId: string) => void;
}> = ({ customerId, items, taxonomy, onClose, onJump }) => {
  const mine = items.filter((item) => item.customerId === customerId);
  const first = mine[0];
  const name = first ? customerLabel(first) : null;
  const open = mine.filter((item) => item.status === 'pending');
  const resolved = mine.filter((item) => item.status === 'completed');
  const repeatCalls = Math.max(
    0,
    ...mine.map((item) => item.repeatCallerCount)
  );

  return (
    <DrawerShell
      label="Customer"
      onClose={onClose}
      header={
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 flex-none items-center justify-center rounded-full bg-[#f3efff] text-[11px] font-bold text-[#5b21e6]">
            {name ? initialsOf(name) : '—'}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[14px] font-bold text-[#15161d]">
              {name ?? 'Name not on the record'}
            </p>
            <p className="truncate text-[11px] text-[#98a2b3]">
              {first?.customerPhone ?? 'No number on the record'}
            </p>
          </div>
        </div>
      }
    >
      <div className="flex gap-2">
        <StatTile
          label="Open items"
          value={open.length}
          onClick={onJump ? () => onJump('open', customerId) : undefined}
        />
        <StatTile
          label="Resolved"
          value={resolved.length}
          onClick={onJump ? () => onJump('resolved', customerId) : undefined}
        />
        <StatTile
          label="Repeat calls"
          value={repeatCalls}
          onClick={onJump ? () => onJump('repeat', customerId) : undefined}
        />
      </div>
      <p className="text-[10.5px] leading-snug text-[#98a2b3]">
        Counted over the items this page loaded, not the customer&apos;s whole
        history. Closed history is not fetchable yet.
      </p>

      <div className="flex flex-col gap-2">
        <SectionLabel text="Open items" hint={formatCount(open.length)} />
        {open.length === 0 ? (
          <p className="text-[12px] text-[#98a2b3]">Nothing open right now.</p>
        ) : (
          open.map((item) => (
            <div
              key={item.actionItemId}
              className={cx(CARD, 'flex flex-col gap-1.5 p-2.5')}
            >
              <div className="flex items-center gap-1.5">
                <IntentBadge intentCode={item.intentCode} taxonomy={taxonomy} />
                {isPastSla(item, taxonomy) === true ? (
                  <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-[#667085]">
                    <PiWarningBold size={11} /> Past SLA
                  </span>
                ) : null}
              </div>
              <p className="text-[12px] leading-snug text-[#667085]">
                {item.whatNeedsDoing}
              </p>
            </div>
          ))
        )}
      </div>

      <div className="flex flex-col gap-2">
        <SectionLabel text="Resolved" hint={formatCount(resolved.length)} />
        {resolved.length === 0 ? (
          <p className="text-[12px] text-[#98a2b3]">
            Nothing resolved for them on this page.
          </p>
        ) : (
          resolved.map((item) => (
            <div
              key={item.actionItemId}
              className={cx(CARD, 'flex flex-col gap-1.5 p-2.5')}
            >
              <div className="flex items-center gap-1.5">
                <span className="text-[#0f6e4f]">
                  <PiCheckCircleBold size={13} />
                </span>
                <IntentBadge intentCode={item.intentCode} taxonomy={taxonomy} />
                <span className="ml-auto text-[10px] tabular-nums text-[#98a2b3]">
                  {formatTimestamp(item.closedAt)}
                </span>
              </div>
              <p className="text-[12px] leading-snug text-[#667085]">
                {item.resolutionNote || item.whatNeedsDoing}
              </p>
            </div>
          ))
        )}
      </div>
    </DrawerShell>
  );
};

/* ── Source overlay ──────────────────────────────────────────────── */

type SourceState =
  | { kind: 'loading' }
  | { kind: 'call'; report: ViniCallReport }
  | { kind: 'conversation'; turns: { role: string; text: string }[] }
  | { kind: 'failed'; message: string };

/**
 * Row 33 and row 34. The call, or the conversation thread.
 *
 * `call` mode fetches the end-call report and renders the recording, the
 * summary and the transcript. No AI score, per row 33.
 *
 * `conversation` mode prefers the live thread. When that call fails, it falls
 * back to the evidence turns the item itself carries, which is real data off
 * the same record, not a substitute made up here.
 */
export const ViniSourceDrawer: React.FC<{
  item: ViniActionItem;
  mode: 'call' | 'conversation';
  enterpriseId: string;
  teamId: string;
  department: ViniActionItemsDepartment;
  onClose: () => void;
}> = ({ item, mode, enterpriseId, teamId, department, onClose }) => {
  const [state, setState] = useState<SourceState>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    setState({ kind: 'loading' });

    if (mode === 'call') {
      fetchViniCallReportAPI(item.sourceCallId ?? '')
        .then((raw) => {
          if (!cancelled) {
            setState({ kind: 'call', report: mapViniCallReport(raw) });
          }
        })
        .catch(() => {
          if (!cancelled) {
            setState({
              kind: 'failed',
              message: 'The call report did not load.',
            });
          }
        });
      return () => {
        cancelled = true;
      };
    }

    fetchViniCustomerConversationsAPI({
      customerId: item.customerId,
      enterpriseId,
      teamId,
      department,
    })
      .then((result) => {
        if (cancelled) return;
        const turns = (result.conversations as Record<string, unknown>[])
          .flatMap((conversation) => {
            const messages = conversation?.messages;
            return Array.isArray(messages) ? messages : [];
          })
          .map((message: Record<string, unknown>) => ({
            role: String(message?.role ?? message?.author ?? 'customer'),
            text: String(message?.message ?? message?.text ?? '').trim(),
          }))
          .filter((turn) => turn.text);

        setState({
          kind: 'conversation',
          turns: turns.length ? turns : item.evidenceTurns,
        });
      })
      .catch(() => {
        if (cancelled) return;
        // Fall back to what the item itself carries, and only that.
        setState(
          item.evidenceTurns.length
            ? { kind: 'conversation', turns: item.evidenceTurns }
            : {
                kind: 'failed',
                message: 'The conversation did not load.',
              }
        );
      });

    return () => {
      cancelled = true;
    };
  }, [item, mode, enterpriseId, teamId, department]);

  return (
    <DrawerShell
      wide
      label={mode === 'call' ? 'The call' : 'The conversation'}
      onClose={onClose}
      header={
        <div className="flex items-center gap-2">
          <span className="text-[#5b21e6]">
            {mode === 'call' ? (
              <PiPlayCircleBold size={16} />
            ) : (
              <PiPhoneBold size={16} />
            )}
          </span>
          <p className="truncate text-[14px] font-bold text-[#15161d]">
            {mode === 'call' ? 'The call' : 'The conversation'}
          </p>
        </div>
      }
    >
      {state.kind === 'loading' ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="h-4 animate-pulse rounded bg-[#eceef2]"
            />
          ))}
        </div>
      ) : state.kind === 'failed' ? (
        <EmptyPanel
          icon={<PiWarningBold size={22} />}
          title={state.message}
          body="Nothing is shown rather than a partial record."
        />
      ) : state.kind === 'call' ? (
        <>
          {state.report.recordingUrl ? (
            <audio
              controls
              preload="none"
              src={state.report.recordingUrl}
              className="w-full"
            />
          ) : (
            <p className="text-[12px] italic text-[#98a2b3]">
              No recording on this call.
            </p>
          )}

          {state.report.summaryPoints.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              <SectionLabel text="Call summary" />
              <ul className="flex list-disc flex-col gap-1 pl-4">
                {state.report.summaryPoints.map((point, index) => (
                  <li
                    key={index}
                    className="text-[12px] leading-relaxed text-[#667085]"
                  >
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <SectionLabel text="Transcript" />
            {state.report.messages.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                {state.report.messages.map((message, index) => (
                  <div
                    key={index}
                    className={cx(
                      'rounded-lg px-2.5 py-1.5 text-[12px] leading-relaxed',
                      message.role === 'agent'
                        ? 'bg-[#f3efff] text-[#667085]'
                        : 'bg-[#fafafa] text-[#667085]'
                    )}
                  >
                    <span className="mr-1.5 align-top text-[9px] font-bold uppercase tracking-wide text-[#98a2b3]">
                      {message.role === 'agent' ? 'Spyne' : 'Customer'}
                    </span>
                    {message.text}
                  </div>
                ))}
              </div>
            ) : state.report.transcript ? (
              <pre className="whitespace-pre-wrap rounded-lg bg-[#fafafa] px-2.5 py-2 text-[12px] leading-relaxed text-[#667085]">
                {state.report.transcript}
              </pre>
            ) : (
              <p className="text-[12px] italic text-[#98a2b3]">
                No transcript on this call.
              </p>
            )}
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-1.5">
          <SectionLabel text="Conversation" />
          {state.turns.map((turn, index) => (
            <div
              key={index}
              className={cx(
                'rounded-lg px-2.5 py-1.5 text-[12px] leading-relaxed',
                /assistant|agent|\bai\b|vini|bot/i.test(turn.role)
                  ? 'bg-[#f3efff] text-[#667085]'
                  : 'bg-[#fafafa] text-[#667085]'
              )}
            >
              <span className="mr-1.5 align-top text-[9px] font-bold uppercase tracking-wide text-[#98a2b3]">
                {/assistant|agent|\bai\b|vini|bot/i.test(turn.role)
                  ? 'Spyne'
                  : 'Customer'}
              </span>
              {turn.text}
            </div>
          ))}
          <GhostButton
            className="mt-2 self-start !text-[#5b21e6]"
            onClick={onClose}
          >
            <PiArrowSquareOutBold size={12} /> Close and go back to the queue
          </GhostButton>
        </div>
      )}
    </DrawerShell>
  );
};
