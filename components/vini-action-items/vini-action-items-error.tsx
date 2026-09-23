'use client';

import React from 'react';
import { PiArrowClockwiseBold, PiWarningBold } from 'react-icons/pi';

import { CARD, EmptyPanel, PrimaryButton } from './vini-action-items-atoms';

/**
 * The queue failed to load.
 *
 * Same page furniture as the loaded state, so a successful retry does not make
 * the layout jump. The KPI tiles are deliberately not drawn as zeros here.
 */
const ViniActionItemsError: React.FC<{ onRetry?: () => void }> = ({
  onRetry,
}) => (
  <div className="flex flex-col gap-4">
    <h1 className="text-[20px] font-bold leading-[1.2] tracking-[-0.035em] text-[#15161d] sm:text-[24px]">
      Action Alerts
    </h1>

    <div className={CARD}>
      <EmptyPanel
        icon={<PiWarningBold size={24} />}
        title="Could not load the queue"
        body="Spyne kept logging what customers asked for. Only this list failed to load."
      >
        {onRetry ? (
          <PrimaryButton className="mt-2" onClick={onRetry}>
            <PiArrowClockwiseBold size={14} /> Retry
          </PrimaryButton>
        ) : null}
      </EmptyPanel>
    </div>
  </div>
);

export default ViniActionItemsError;
