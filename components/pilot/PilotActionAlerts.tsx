'use client';

/**
 * The pilot page body. Same furniture as the native page on the
 * RELEASE-RETCONVAI-5053 branch, minus the console's entitlement check,
 * which the console runs before it frames this app.
 */
import React from 'react';

import ViniActionItems from '@/components/vini-action-items/vini-action-items';
import ViniActionItemsError from '@/components/vini-action-items/vini-action-items-error';
import ViniActionItemsShimmer from '@/components/vini-action-items/vini-action-items-shimmer';

import useViniActionItems from '@/hooks/use-vini-action-items';

import { setViniEmbedScope } from '@/services/vini-action-items.service';

const PilotActionAlerts: React.FC<{
  env: string;
  token: string;
  enterpriseId: string;
  teamId: string;
}> = ({ env, token, enterpriseId, teamId }) => {
  // Before the hook's first effect fires, so every call carries scope.
  setViniEmbedScope({ env, token, enterpriseId, teamId });

  const department = 'service' as const;
  const {
    items,
    taxonomy,
    taxonomyLoaded,
    users,
    metrics,
    isLoading,
    error,
    refetch,
    resolve,
    markIncorrect,
    assign,
    reopenLocally,
    restoreIncorrectLocally,
    saveIntentSla,
  } = useViniActionItems({ department, enterpriseId, teamId });

  return (
    <div className="font-inter flex h-screen w-full min-w-0 flex-col gap-4 overflow-y-auto overflow-x-hidden bg-[#fafafa] p-4 sm:p-6 lg:p-8">
      {isLoading && <ViniActionItemsShimmer />}

      {!isLoading && error && <ViniActionItemsError onRetry={refetch} />}

      {!isLoading && !error && (
        <ViniActionItems
          items={items}
          taxonomy={taxonomy}
          taxonomyLoaded={taxonomyLoaded}
          users={users}
          metrics={metrics}
          department={department}
          mode="service"
          enterpriseId={enterpriseId}
          teamId={teamId}
          onResolve={resolve}
          onAssign={assign}
          onMarkIncorrect={markIncorrect}
          onReopenLocally={reopenLocally}
          onRestoreIncorrectLocally={restoreIncorrectLocally}
          onSaveIntentSla={saveIntentSla}
        />
      )}
    </div>
  );
};

export default PilotActionAlerts;
