'use client'

/**
 * WaveformPlayer — 1:1 port of the production Call-Logs waveform player
 * (apps/converse-ai/components/Call-Logs/waveform-player.tsx) for the read-only embed.
 * Exposes seek/play/pause via ref so transcript turns can jump the audio.
 */
import WavesurferPlayer from '@wavesurfer/react'
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { AiOutlineLoading3Quarters } from 'react-icons/ai'
import { FaDownload, FaPause, FaPlay, FaSync } from 'react-icons/fa'
import { MdAudioFile } from 'react-icons/md'

function formatAudioTime(seconds) {
  if (!seconds || isNaN(seconds) || !isFinite(seconds) || seconds < 0) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${String(secs).padStart(2, '0')}`
}

const WaveformPlayer = forwardRef(function WaveformPlayer(
  { url, onTimeUpdate, onPlay, onPause, onReady: onReadyProp, onError: onErrorProp },
  ref,
) {
  const [wavesurfer, setWavesurfer] = useState(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isReady, setIsReady] = useState(false)
  const [hasError, setHasError] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const previousUrlRef = useRef(url)

  useEffect(() => {
    if (previousUrlRef.current !== url) {
      setIsReady(false); setHasError(false); setIsPlaying(false); setCurrentTime(0); setDuration(0); setWavesurfer(null)
      previousUrlRef.current = url
    }
  }, [url])

  useImperativeHandle(ref, () => ({
    seek: (time) => {
      if (wavesurfer && isReady) {
        try {
          const dur = wavesurfer.getDuration()
          if (isFinite(time) && isFinite(dur) && dur > 0) wavesurfer.setTime(Math.max(0, Math.min(time, dur)))
        } catch {}
      }
    },
    play: () => { if (wavesurfer && isReady) { try { wavesurfer.play() } catch {} } },
    pause: () => { if (wavesurfer && isReady) { try { wavesurfer.pause() } catch {} } },
  }), [wavesurfer, isReady])

  const handleReady = useCallback((ws) => {
    setWavesurfer(ws); setIsReady(true); setHasError(false); setIsPlaying(false)
    try { const dur = ws.getDuration(); if (isFinite(dur) && dur > 0) setDuration(dur) } catch {}
    onReadyProp?.()
  }, [onReadyProp])

  const handleError = useCallback(() => { setHasError(true); setIsReady(false); onErrorProp?.() }, [onErrorProp])
  const handleTimeUpdate = useCallback((_ws, time) => { setCurrentTime(time); onTimeUpdate?.(time) }, [onTimeUpdate])
  const handlePlayPause = useCallback(() => { if (wavesurfer && isReady) { try { wavesurfer.playPause() } catch {} } }, [wavesurfer, isReady])
  const handleRestart = useCallback(() => { if (wavesurfer && isReady) { try { if (wavesurfer.getDuration() > 0) wavesurfer.setTime(0) } catch {} } }, [wavesurfer, isReady])

  const isValidUrl = url && url.length > 0 && (url.startsWith('http://') || url.startsWith('https://'))
  if (!isValidUrl) {
    return (
      <div className="flex h-20 items-center justify-center rounded-lg border border-gray-100 bg-gray-50 p-3">
        <span className="text-sm text-gray-400">No recording available</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3" onClick={(e) => e.stopPropagation()}>
      {isReady && (
        <button onClick={handlePlayPause} className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full transition-all duration-200" style={{ backgroundColor: '#4600f2', color: 'white' }} title={isPlaying ? 'Pause' : 'Play'}>
          {isPlaying ? <FaPause className="h-3 w-3 text-white" /> : <FaPlay className="h-3 w-3 text-white" />}
        </button>
      )}
      {isReady && (
        <div className="flex-shrink-0 text-sm font-normal tabular-nums text-gray-600">
          <span>{formatAudioTime(currentTime)}</span>
          <span className="mx-1 text-gray-400">/</span>
          <span>{formatAudioTime(duration)}</span>
        </div>
      )}
      <div className="relative min-w-0 flex-1">
        {!hasError && (
          <WavesurferPlayer
            key={url}
            url={url}
            waveColor="#e5e5e5"
            progressColor="#4600F2"
            cursorColor="transparent"
            height={45}
            barHeight={2}
            barWidth={2}
            barGap={1.5}
            barRadius={5}
            onReady={handleReady}
            onPlay={() => { setIsPlaying(true); onPlay?.() }}
            onPause={() => { setIsPlaying(false); onPause?.() }}
            onTimeupdate={handleTimeUpdate}
            onError={handleError}
          />
        )}
        {!isReady && !hasError && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-gray-50">
            <AiOutlineLoading3Quarters className="h-4 w-4 animate-spin text-[#4600f2]" />
            <span className="text-xs text-gray-500">Loading Audio...</span>
          </div>
        )}
        {hasError && (
          <div className="flex h-[45px] items-center justify-center gap-2 bg-gray-50">
            <MdAudioFile className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-400">Audio not present</span>
          </div>
        )}
      </div>
      {isReady && (
        <button onClick={handleRestart} className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md p-0 hover:bg-gray-200" title="Restart">
          <FaSync className="h-3.5 w-3.5 text-gray-500" />
        </button>
      )}
      {isReady && (
        <a href={url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md p-0 hover:bg-gray-200" title="Download">
          <FaDownload className="h-3.5 w-3.5 text-gray-500" />
        </a>
      )}
    </div>
  )
})

export default WaveformPlayer
