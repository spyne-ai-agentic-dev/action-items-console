'use client';

import {
  assignViniActionItemAPI,
  fetchViniActionItemMetricsAPI,
  fetchViniActionItemUsersAPI,
  fetchViniActionItemsAPI,
  fetchViniActionItemsConfigAPI,
  fetchViniDealerIntentConfigAPI,
  fetchViniIntentCatalogAPI,
  markViniActionItemsIncorrectAPI,
  resolveViniActionItemsAPI,
  statusOf,
  upsertViniDealerIntentConfigAPI,
} from '@/services/vini-action-items.service';

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  ViniActionItem,
  ViniActionItemMetrics,
  ViniActionItemsDepartment,
  ViniActionItemsUser,
  ViniIncorrectReason,
  ViniIntentTaxonomy,
  ViniResolutionType,
  buildViniIntentTaxonomy,
  mapViniActionItemMetricsResponse,
  mapViniActionItemsResponse,
  mapViniUserListResponse,
} from '@/components/vini-action-items/vini-action-items-data';

/** Why the tiles are not showing numbers, when they are not. */
export type ViniMetricsState =
  | { kind: 'loading' }
  | { kind: 'ready'; data: ViniActionItemMetrics }
  /** The endpoint is not deployed here. Production answers 404 today. */
  | { kind: 'unavailable' }
  /** Deployed, but this call failed. Still never a zero. */
  | { kind: 'failed' };

export interface ViniActionItemsWriteResult {
  ok: boolean;
  message: string;
}

interface UseViniActionItemsResult {
  items: ViniActionItem[];
  taxonomy: ViniIntentTaxonomy;
  /** Null while the catalog is still loading, so the UI can wait, not guess. */
  taxonomyLoaded: boolean;
  users: ViniActionItemsUser[];
  metrics: ViniMetricsState;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
  resolve: (args: {
    actionItemIds: string[];
    resolutionType: ViniResolutionType;
    note?: string;
    actingUserId?: string;
  }) => Promise<ViniActionItemsWriteResult>;
  markIncorrect: (args: {
    actionItemId: string;
    reason: ViniIncorrectReason;
    correctedIntentCode?: string;
    actingUserId?: string;
  }) => Promise<ViniActionItemsWriteResult>;
  assign: (args: {
    actionItemId: string;
    userId: string;
  }) => Promise<ViniActionItemsWriteResult>;
  /** Local-only, and the caller must say so. No unresolve endpoint exists. */
  reopenLocally: (actionItemId: string) => void;
  restoreIncorrectLocally: (actionItemId: string) => void;
  saveIntentSla: (args: {
    intentCode: string;
    slaMinutes: number;
    serviceType: string;
    actingUserId?: string;
  }) => Promise<ViniActionItemsWriteResult>;
}

/**
 * Everything the Action Items page reads and writes.
 *
 * The hook owns loading, error and refetch, like use-vini-overview. It also
 * owns the optimistic write pattern: apply locally, fire the backend call,
 * and roll the local state back with an honest message if the call fails.
 * A write that silently stayed in the browser is the one failure mode Sumit
 * QAs for on this tab, so every path returns a message the UI must show.
 */
export default function useViniActionItems({
  department,
  enterpriseId,
  teamId,
}: {
  department: ViniActionItemsDepartment;
  enterpriseId: string;
  teamId: string;
}): UseViniActionItemsResult {

  const [items, setItems] = useState<ViniActionItem[]>([]);
  const [taxonomy, setTaxonomy] = useState<ViniIntentTaxonomy>({});
  const [taxonomyLoaded, setTaxonomyLoaded] = useState(false);
  const [users, setUsers] = useState<ViniActionItemsUser[]>([]);
  const [metrics, setMetrics] = useState<ViniMetricsState>({ kind: 'loading' });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refetchToken, setRefetchToken] = useState(0);

  /** Mirrors `items` so a write can roll back without a stale closure. */
  const itemsRef = useRef<ViniActionItem[]>([]);
  itemsRef.current = items;

  /* ── Rows. This one gates the page. ───────────────────────────── */
  useEffect(() => {
    if (!enterpriseId || !teamId) {
      setIsLoading(true);
      return undefined;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    fetchViniActionItemsAPI({ enterpriseId, teamId })
      .then((response) => {
        if (cancelled) return;
        setItems(mapViniActionItemsResponse(response));
        setError(null);
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        setItems([]);
        setError(
          caught instanceof Error
            ? caught
            : new Error('Could not load the action items')
        );
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [enterpriseId, teamId, refetchToken]);

  /* ── The taxonomy. Three endpoints, one merge. ────────────────── */
  useEffect(() => {
    if (!enterpriseId || !teamId) return undefined;
    let cancelled = false;
    setTaxonomyLoaded(false);

    // Parallel, never one await per department in a loop.
    Promise.allSettled([
      fetchViniIntentCatalogAPI(),
      fetchViniActionItemsConfigAPI('sales'),
      fetchViniActionItemsConfigAPI('service'),
      fetchViniDealerIntentConfigAPI({ enterpriseId, teamId }),
    ])
      .then(([catalog, salesConfig, serviceConfig, dealerConfig]) => {
        if (cancelled) return;
        setTaxonomy(
          buildViniIntentTaxonomy({
            catalog: catalog.status === 'fulfilled' ? catalog.value : [],
            configs: [
              salesConfig.status === 'fulfilled' ? salesConfig.value : null,
              serviceConfig.status === 'fulfilled' ? serviceConfig.value : null,
            ].filter(Boolean) as never[],
            dealerConfig:
              dealerConfig.status === 'fulfilled' ? dealerConfig.value : [],
          })
        );
      })
      .finally(() => {
        if (!cancelled) setTaxonomyLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [enterpriseId, teamId, refetchToken]);

  /* ── Assignable advisors. Not fatal if it fails. ──────────────── */
  useEffect(() => {
    if (!enterpriseId || !teamId) return undefined;
    let cancelled = false;

    fetchViniActionItemUsersAPI({ enterpriseId, teamId })
      .then((response) => {
        if (!cancelled) setUsers(mapViniUserListResponse(response));
      })
      .catch(() => {
        // The Assign picker renders its own empty state. No roster invented.
        if (!cancelled) setUsers([]);
      });

    return () => {
      cancelled = true;
    };
  }, [enterpriseId, teamId, refetchToken]);

  /* ── Tiles. A 404 here is the normal case on production. ──────── */
  useEffect(() => {
    if (!enterpriseId || !teamId) return undefined;
    let cancelled = false;
    setMetrics({ kind: 'loading' });

    fetchViniActionItemMetricsAPI({ enterpriseId, teamId, department })
      .then((response) => {
        if (cancelled) return;
        setMetrics({
          kind: 'ready',
          data: mapViniActionItemMetricsResponse(response),
        });
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        const status = statusOf(caught);
        // 404 means the endpoint is not deployed in this environment at all.
        setMetrics(
          status === 404 || status === 501
            ? { kind: 'unavailable' }
            : { kind: 'failed' }
        );
      });

    return () => {
      cancelled = true;
    };
  }, [enterpriseId, teamId, department, refetchToken]);

  const refetch = useCallback(() => setRefetchToken((token) => token + 1), []);

  /* ── Writes ───────────────────────────────────────────────────── */

  const patchItems = useCallback(
    (ids: string[], patch: Partial<ViniActionItem>) => {
      setItems((previous) =>
        previous.map((item) =>
          ids.includes(item.actionItemId) ? { ...item, ...patch } : item
        )
      );
    },
    []
  );

  /** Put the named items back exactly as they were before the write. */
  const rollback = useCallback((snapshot: ViniActionItem[]) => {
    const byId = new Map(snapshot.map((item) => [item.actionItemId, item]));
    setItems((previous) =>
      previous.map((item) => byId.get(item.actionItemId) ?? item)
    );
  }, []);

  const resolve = useCallback<UseViniActionItemsResult['resolve']>(
    async ({ actionItemIds, resolutionType, note, actingUserId }) => {
      const ids = [...new Set(actionItemIds)].filter(Boolean);
      if (!ids.length) return { ok: true, message: '' };

      const snapshot = itemsRef.current.filter((item) =>
        ids.includes(item.actionItemId)
      );
      const closedAt = new Date().toISOString();

      patchItems(ids, {
        status: 'completed',
        resolutionType,
        resolutionNote: note?.trim() || undefined,
        closedAt,
        ...(actingUserId ? { assigneeUserId: actingUserId } : {}),
      });

      try {
        await resolveViniActionItemsAPI({
          actionItemId: ids.length === 1 ? ids[0] : ids,
          resolutionType,
          note,
          resolvedBy: actingUserId,
        });
      } catch {
        rollback(snapshot);
        return {
          ok: false,
          message:
            ids.length === 1
              ? 'Could not resolve it. Nothing was saved, please try again.'
              : 'Could not resolve those items. Nothing was saved, please try again.',
        };
      }

      // The resolver becomes the assignee. Parallel, not one await per item.
      if (actingUserId) {
        const leadIds = [
          ...new Set(
            snapshot.map((item) => item.leadId).filter(Boolean) as string[]
          ),
        ];
        const assignments = await Promise.allSettled(
          leadIds.map((leadId) =>
            assignViniActionItemAPI({ leadId, userId: actingUserId })
          )
        );
        if (assignments.some((result) => result.status === 'rejected')) {
          return {
            ok: true,
            message:
              'Resolved. The assignee did not save, so it still shows its old owner.',
          };
        }
      }

      return {
        ok: true,
        message:
          ids.length === 1 ? 'Resolved.' : `Resolved ${ids.length} items.`,
      };
    },
    [patchItems, rollback]
  );

  const markIncorrect = useCallback<UseViniActionItemsResult['markIncorrect']>(
    async ({ actionItemId, reason, correctedIntentCode, actingUserId }) => {
      const snapshot = itemsRef.current.filter(
        (item) => item.actionItemId === actionItemId
      );
      const original = snapshot[0];
      if (!original) return { ok: false, message: 'That item is gone.' };

      patchItems([actionItemId], {
        status: 'incorrect',
        incorrectReason: reason,
        ...(correctedIntentCode
          ? {
              originalIntentCode: original.intentCode,
              intentCode: correctedIntentCode,
            }
          : {}),
      });

      const note = correctedIntentCode
        ? `Reclassified from ${original.intentCode} to ${correctedIntentCode}`
        : undefined;

      try {
        await markViniActionItemsIncorrectAPI({
          actionItemId,
          reason,
          note,
          resolvedBy: actingUserId,
        });
      } catch {
        rollback(snapshot);
        return {
          ok: false,
          message: 'Could not flag it. Nothing was saved, please try again.',
        };
      }

      return {
        ok: true,
        message: correctedIntentCode
          ? 'Reclassified and flagged.'
          : 'Flagged incorrect.',
      };
    },
    [patchItems, rollback]
  );

  const assign = useCallback<UseViniActionItemsResult['assign']>(
    async ({ actionItemId, userId }) => {
      const snapshot = itemsRef.current.filter(
        (item) => item.actionItemId === actionItemId
      );
      const target = snapshot[0];
      if (!target) return { ok: false, message: 'That item is gone.' };

      const leadId = target.leadId;
      if (!leadId) {
        // Assignment keys on the lead. No lead, no write to attempt.
        return {
          ok: false,
          message: 'Cannot assign this one. It carries no lead to assign.',
        };
      }

      const assignedName =
        users.find((user) => user.userId === userId)?.name ?? null;
      patchItems([actionItemId], {
        assigneeUserId: userId,
        assigneeName: assignedName ?? undefined,
      });

      try {
        await assignViniActionItemAPI({ leadId, userId });
      } catch {
        rollback(snapshot);
        return {
          ok: false,
          message: 'Could not assign it. Nothing was saved, please try again.',
        };
      }

      return {
        ok: true,
        message: assignedName ? `Assigned to ${assignedName}.` : 'Assigned.',
      };
    },
    [patchItems, rollback, users]
  );

  /**
   * Reopen. Browser only, and the caller has to say so in the toast.
   *
   * There is no unresolve endpoint. Nothing is sent, nothing persists, and a
   * refresh puts the item back in Resolved.
   */
  const reopenLocally = useCallback(
    (actionItemId: string) => {
      patchItems([actionItemId], {
        status: 'pending',
        resolutionType: undefined,
        resolutionNote: undefined,
        closedAt: undefined,
      });
    },
    [patchItems]
  );

  /** Same local-only revert for a flagged item. */
  const restoreIncorrectLocally = useCallback(
    (actionItemId: string) => {
      const target = itemsRef.current.find(
        (item) => item.actionItemId === actionItemId
      );
      patchItems([actionItemId], {
        status: 'pending',
        incorrectReason: undefined,
        ...(target?.originalIntentCode
          ? {
              intentCode: target.originalIntentCode,
              originalIntentCode: undefined,
            }
          : {}),
      });
    },
    [patchItems]
  );

  const saveIntentSla = useCallback<UseViniActionItemsResult['saveIntentSla']>(
    async ({ intentCode, slaMinutes, serviceType, actingUserId }) => {
      if (!enterpriseId || !teamId) {
        return { ok: false, message: 'No rooftop in context.' };
      }

      const previous = taxonomy[intentCode];
      setTaxonomy((current) => ({
        ...current,
        [intentCode]: {
          ...current[intentCode],
          slaMinutes,
          slaIsRooftopOverride: true,
        },
      }));

      try {
        await upsertViniDealerIntentConfigAPI({
          enterpriseId,
          teamId,
          intentCode,
          serviceType,
          customSlaMinutes: slaMinutes,
          updatedBy: actingUserId,
        });
      } catch {
        setTaxonomy((current) => ({
          ...current,
          [intentCode]: previous ?? current[intentCode],
        }));
        return {
          ok: false,
          message: 'Could not save that SLA. It has been put back.',
        };
      }

      return { ok: true, message: 'SLA saved for this rooftop.' };
    },
    [enterpriseId, teamId, taxonomy]
  );

  return {
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
  };
}
