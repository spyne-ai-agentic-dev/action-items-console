'use client';

/**
 * The right-hand Open items pane: one card per item, with the three writes.
 *
 * Decision rows kept here: 14 activity log, 15 flag at the row, 32 urgency,
 * 33 Listen, 34 open the conversation, 35 assign to a named advisor,
 * 50 close control, 53 the promised time, 54 the footer explanation,
 * 57 row click to detail, 58 description, 59 the quoted customer line,
 * 60 creation timestamp, 61 assignee, 62 resolve.
 *
 * Row 51, the AI-drafted reply, and row 52, per-task-type fact fields, are
 * rendered as locked. No backend field holds a draft or a task-type field set.
 * Row 33 drops the AI score from Listen, per the decision, so the score is
 * never read here even though the call report carries one.
 */
import React, { useState } from 'react';
import {
  PiCheckCircleBold,
  PiChecksBold,
  PiClockBold,
  PiFlagBold,
  PiNoteBold,
  PiPlayCircleBold,
  PiRobotBold,
  PiUserPlusBold,
} from 'react-icons/pi';

import { Locked } from '@/components/vini-shared/locked';

import {
  AssigneeLine,
  CARD,
  ChannelChip,
  CustomerNameButton,
  EmptyPanel,
  GhostButton,
  PrimaryButton,
  SecondaryButton,
  SectionLabel,
  SlaState,
  cx,
} from './vini-action-items-atoms';
import {
  VINI_INCORRECT_REASONS,
  VINI_RESOLUTION_TYPES,
  ViniActionItem,
  ViniActionItemsUser,
  ViniIncorrectReason,
  ViniIntentMeta,
  ViniIntentTaxonomy,
  ViniResolutionType,
  ageLabel,
  ageMinutes,
  formatTimestamp,
  intentLabel,
  isPastSla,
} from './vini-action-items-data';
import { LockedNote } from './vini-action-items-locked';

type PendingAction = 'resolve' | 'assign' | 'incorrect' | null;

/* ── The source block ────────────────────────────────────────────── */

const SourceBlock: React.FC<{
  item: ViniActionItem;
  onOpenCall: (item: ViniActionItem) => void;
  onOpenConversation: (item: ViniActionItem) => void;
}> = ({ item, onOpenCall, onOpenConversation }) => {
  const customerTurns = item.evidenceTurns.filter(
    (turn) => turn.role === 'customer'
  );
  const aiTurns = item.evidenceTurns.filter((turn) => turn.role === 'ai');
  const hasConversation =
    !!item.sourceConversationId || item.evidenceTurns.length > 0;

  return (
    <div className="min-w-0 flex-1 border-l-2 border-[#eceef2] pl-3">
      <div className="flex items-center gap-2">
        <span className="text-[9.5px] font-bold uppercase tracking-wide text-[#98a2b3]">
          Source
        </span>
        <div className="ml-auto flex items-center gap-1">
          <GhostButton
            onClick={() => onOpenCall(item)}
            disabled={!item.sourceCallId}
            title={
              item.sourceCallId
                ? 'Open the call'
                : 'No call is linked to this item'
            }
            className={cx(
              '!text-[10.5px]',
              item.sourceCallId && '!text-[#5b21e6]'
            )}
          >
            <PiPlayCircleBold size={13} /> Listen
          </GhostButton>
          <GhostButton
            onClick={() => onOpenConversation(item)}
            disabled={!hasConversation}
            title={
              hasConversation
                ? 'Open the conversation'
                : 'No conversation is linked to this item'
            }
            className={cx(
              '!text-[10.5px]',
              hasConversation && '!text-[#5b21e6]'
            )}
          >
            <PiNoteBold size={13} /> Transcript
          </GhostButton>
        </div>
      </div>

      {item.evidenceTurns.length === 0 ? (
        item.sourceMessage ? (
          <p className="mt-1.5 rounded-lg bg-[#fafafa] px-2.5 py-2 text-[12.5px] italic leading-relaxed text-[#667085]">
            {item.sourceMessage}
          </p>
        ) : (
          <p className="mt-1.5 text-[12px] italic text-[#98a2b3]">
            No quote came back with this item.
          </p>
        )
      ) : (
        <div className="mt-1.5 flex flex-col gap-1.5">
          {customerTurns.map((turn, index) => (
            <div
              key={`customer-${index}`}
              className="rounded-lg bg-[#fafafa] px-2.5 py-1.5 text-[12px] leading-relaxed text-[#667085]"
            >
              <span className="mr-1.5 align-top text-[9px] font-bold uppercase tracking-wide text-[#98a2b3]">
                Customer
              </span>
              {turn.text}
            </div>
          ))}
          {/* Row 54. Vini's reasoning, labelled as reasoning, not as a spoken
              line. P4 pastes this to eng when flagging a wrong answer. */}
          {aiTurns.length > 0 ? (
            <div className="rounded-lg bg-[#f3efff] px-2.5 py-1.5">
              <p className="mb-0.5 inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide text-[#5b21e6]">
                <PiRobotBold size={11} /> Why Spyne flagged this
              </p>
              {aiTurns.map((turn, index) => (
                <p
                  key={`ai-${index}`}
                  className="text-[12px] italic leading-relaxed text-[#667085]"
                >
                  {turn.text}
                </p>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

/* ── Activity ────────────────────────────────────────────────────── */

/**
 * Row 14. The trail, built only from stamps the record carries.
 *
 * Created and closed are real fields. Everything between them, who picked it
 * up and when, who reassigned it, is not stored anywhere, so the panel says so
 * with the shared `activityTrail` reason rather than implying the two stamps
 * are the whole history.
 */
const ActivityTrail: React.FC<{
  item: ViniActionItem;
  users: ViniActionItemsUser[];
}> = ({ item, users }) => {
  const assigneeName =
    item.assigneeName ??
    users.find((user) => user.userId === item.assigneeUserId)?.name;

  return (
    <div>
      <SectionLabel text="Activity" />
      <ol className="mt-1.5 flex flex-col gap-1.5">
        <li className="flex items-center gap-2 text-[11px]">
          <span className="text-[#98a2b3]">
            {item.createdByAi ? (
              <PiRobotBold size={12} />
            ) : (
              <PiUserPlusBold size={12} />
            )}
          </span>
          <span className="text-[#667085]">
            {item.createdByAi ? 'Logged by Spyne' : 'Logged by an advisor'}
          </span>
          <span className="ml-auto tabular-nums text-[#98a2b3]">
            {ageLabel(ageMinutes(item.createdAt))}
          </span>
        </li>
        {item.assigneeUserId ? (
          <li className="flex items-center gap-2 text-[11px]">
            <span className="text-[#98a2b3]">
              <PiUserPlusBold size={12} />
            </span>
            <span className="truncate text-[#667085]">
              {assigneeName
                ? `Assigned to ${assigneeName}`
                : 'Assigned, no name on the record'}
            </span>
          </li>
        ) : null}
        {item.status === 'completed' ? (
          <li className="flex items-center gap-2 text-[11px]">
            <span className="text-[#0f6e4f]">
              <PiCheckCircleBold size={12} />
            </span>
            <span className="text-[#667085]">Resolved</span>
            {item.closedAt ? (
              <span className="ml-auto tabular-nums text-[#98a2b3]">
                {ageLabel(ageMinutes(item.closedAt))}
              </span>
            ) : null}
          </li>
        ) : null}
        {item.status === 'incorrect' ? (
          <li className="flex items-center gap-2 text-[11px]">
            <span className="text-[#b54708]">
              <PiFlagBold size={12} />
            </span>
            <span className="text-[#667085]">Flagged incorrect</span>
          </li>
        ) : null}
        <li className="flex items-center gap-2 text-[11px]">
          <span className="text-[#98a2b3]">
            <PiClockBold size={12} />
          </span>
          <span className="text-[#98a2b3]">Everything in between</span>
          <span className="ml-auto">
            <Locked reason="activityTrail" />
          </span>
        </li>
      </ol>
    </div>
  );
};

/* ── The pickers ─────────────────────────────────────────────────── */

const ResolvePicker: React.FC<{
  onResolve: (type: ViniResolutionType, note: string) => void;
  onCancel: () => void;
  busy: boolean;
}> = ({ onResolve, onCancel, busy }) => {
  const [type, setType] = useState<ViniResolutionType | null>(null);
  const [note, setNote] = useState('');

  return (
    <div className="border-t border-[#eceef2] px-4 py-3">
      <p className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wide text-[#98a2b3]">
        How was this resolved?
      </p>
      <div className="flex flex-wrap gap-1.5">
        {VINI_RESOLUTION_TYPES.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setType(option.value)}
            aria-pressed={type === option.value}
            className={cx(
              'rounded-lg border px-2 py-1 text-[11px] font-medium transition-colors',
              type === option.value
                ? 'border-[#5b21e6] bg-[#f3efff] text-[#5b21e6]'
                : 'border-[#eceef2] text-[#667085] hover:border-[#d0d5dd]'
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
      <input
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Add a note, optional"
        aria-label="Resolution note"
        className="mt-2 h-8 w-full rounded-lg border border-[#eceef2] px-2 text-[12px] text-[#15161d] placeholder:text-[#98a2b3] focus:border-[#5b21e6] focus:outline-none"
      />
      <div className="mt-2 flex items-center gap-2">
        <PrimaryButton
          className="h-8 flex-1"
          disabled={!type || busy}
          onClick={() => type && onResolve(type, note)}
        >
          <PiCheckCircleBold size={13} /> Confirm resolution
        </PrimaryButton>
        <GhostButton onClick={onCancel} disabled={busy}>
          Cancel
        </GhostButton>
      </div>
    </div>
  );
};

const AssignPicker: React.FC<{
  users: ViniActionItemsUser[];
  onAssign: (userId: string) => void;
  onCancel: () => void;
  busy: boolean;
}> = ({ users, onAssign, onCancel, busy }) => (
  <div className="border-t border-[#eceef2] px-4 py-3">
    <p className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wide text-[#98a2b3]">
      Assign to
    </p>
    {users.length === 0 ? (
      // No roster invented. The old app fell back to a bundled USERS map of
      // made-up advisor names, which would have been assignable in the UI.
      <p className="text-[11.5px] italic text-[#98a2b3]">
        The advisor roster did not load, so there is nobody to assign to.
      </p>
    ) : (
      <div className="flex flex-wrap gap-1.5">
        {users.map((user) => (
          <button
            key={user.userId}
            type="button"
            disabled={busy}
            onClick={() => onAssign(user.userId)}
            className="inline-flex items-center gap-1 rounded-lg border border-[#eceef2] px-2 py-1 text-[11px] font-medium text-[#667085] transition-colors hover:border-[#5b21e6] disabled:opacity-40"
          >
            <span className="flex size-4 items-center justify-center rounded-full bg-[#f3efff] text-[7.5px] font-bold text-[#5b21e6]">
              {user.initials}
            </span>
            {user.name}
          </button>
        ))}
      </div>
    )}
    <div className="mt-2">
      <GhostButton onClick={onCancel} disabled={busy}>
        Cancel
      </GhostButton>
    </div>
  </div>
);

const IncorrectPicker: React.FC<{
  taxonomy: ViniIntentTaxonomy;
  onMark: (reason: ViniIncorrectReason, correctedIntentCode?: string) => void;
  onCancel: () => void;
  busy: boolean;
}> = ({ taxonomy, onMark, onCancel, busy }) => {
  const [pickingIntent, setPickingIntent] = useState(false);
  const [corrected, setCorrected] = useState('');

  // The reclassify picker lists the live catalog only. An intent that is not
  // in the catalog cannot be written back, so it is not offered.
  const options = Object.values(taxonomy)
    .slice()
    .sort((a, b) => a.displayName.localeCompare(b.displayName));

  if (pickingIntent) {
    return (
      <div className="border-t border-[#eceef2] px-4 py-3">
        <p className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wide text-[#98a2b3]">
          What is the correct intent?
        </p>
        {options.length === 0 ? (
          <p className="text-[11.5px] italic text-[#98a2b3]">
            The intent catalog did not load, so there is nothing to reclassify
            to.
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-1.5">
            <select
              value={corrected}
              onChange={(event) => setCorrected(event.target.value)}
              aria-label="The correct intent"
              className="h-8 min-w-[200px] rounded-lg border border-[#eceef2] px-2 text-[12px] focus:border-[#5b21e6] focus:outline-none"
            >
              <option value="">Select the correct intent</option>
              {options.map((intent: ViniIntentMeta) => (
                <option key={intent.intentCode} value={intent.intentCode}>
                  {intent.displayName}
                </option>
              ))}
            </select>
            <PrimaryButton
              className="h-8"
              disabled={!corrected || busy}
              onClick={() => onMark('wrong_intent', corrected)}
            >
              Reclassify and flag
            </PrimaryButton>
          </div>
        )}
        <div className="mt-2">
          <GhostButton onClick={() => setPickingIntent(false)} disabled={busy}>
            Back
          </GhostButton>
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-[#eceef2] px-4 py-3">
      <p className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wide text-[#98a2b3]">
        Why is this incorrect?
      </p>
      <div className="flex flex-wrap gap-1.5">
        {VINI_INCORRECT_REASONS.map((reason) => (
          <button
            key={reason.value}
            type="button"
            disabled={busy}
            onClick={() =>
              reason.value === 'wrong_intent'
                ? setPickingIntent(true)
                : onMark(reason.value)
            }
            className="rounded-lg border border-[#eceef2] px-2 py-1 text-[11px] font-medium text-[#667085] transition-colors hover:border-[#5b21e6] disabled:opacity-40"
          >
            {reason.label}
          </button>
        ))}
      </div>
      <div className="mt-2">
        <GhostButton onClick={onCancel} disabled={busy}>
          Cancel
        </GhostButton>
      </div>
    </div>
  );
};

/* ── One item ────────────────────────────────────────────────────── */

export const ViniActionItemCard: React.FC<{
  item: ViniActionItem;
  taxonomy: ViniIntentTaxonomy;
  users: ViniActionItemsUser[];
  showCustomer: boolean;
  busy: boolean;
  onResolve: (
    item: ViniActionItem,
    type: ViniResolutionType,
    note: string
  ) => void;
  onAssign: (item: ViniActionItem, userId: string) => void;
  onMarkIncorrect: (
    item: ViniActionItem,
    reason: ViniIncorrectReason,
    correctedIntentCode?: string
  ) => void;
  onOpenCustomer: (customerId: string) => void;
  onOpenCall: (item: ViniActionItem) => void;
  onOpenConversation: (item: ViniActionItem) => void;
}> = ({
  item,
  taxonomy,
  users,
  showCustomer,
  busy,
  onResolve,
  onAssign,
  onMarkIncorrect,
  onOpenCustomer,
  onOpenCall,
  onOpenConversation,
}) => {
  const [pending, setPending] = useState<PendingAction>(null);
  const past = isPastSla(item, taxonomy);

  return (
    <div
      className={cx(
        CARD,
        'border-l-[3px] p-0',
        past === true ? 'border-l-[#98a2b3]' : 'border-l-transparent'
      )}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 px-4 pt-3.5">
        <ChannelChip channel={item.channel} />
        <span className="ml-auto">
          <SlaState
            item={item}
            taxonomy={taxonomy}
            ageText={ageLabel(ageMinutes(item.createdAt))}
            pastSla={past}
          />
        </span>
      </div>

      <div className="px-4 py-3">
        {showCustomer ? (
          <div className="mb-2">
            <CustomerNameButton item={item} onOpen={onOpenCustomer} size="sm" />
          </div>
        ) : null}

        <p className="text-[9.5px] font-bold uppercase tracking-wide text-[#98a2b3]">
          What needs doing
        </p>
        <p className="mt-1 text-[15px] font-semibold leading-snug text-[#15161d]">
          {item.whatNeedsDoing || 'No description came back with this item.'}
        </p>

        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:gap-6">
          <SourceBlock
            item={item}
            onOpenCall={onOpenCall}
            onOpenConversation={onOpenConversation}
          />

          <div className="flex flex-col gap-3.5 border-t border-[#eceef2] pt-3 lg:w-[228px] lg:flex-none lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
            <div>
              <p className="mb-1 text-[9.5px] font-bold uppercase tracking-wide text-[#98a2b3]">
                Created
              </p>
              <p className="text-[11px] tabular-nums text-[#667085]">
                {formatTimestamp(item.createdAt) || 'Not on the record'}
              </p>
            </div>

            {/* Row 53. The promised time, so a BDC does not contradict what
                Vini told the customer. Only shown when the item carries one. */}
            <div>
              <p className="mb-1 text-[9.5px] font-bold uppercase tracking-wide text-[#98a2b3]">
                Promised
              </p>
              {item.dueDate ? (
                <p className="text-[11px] tabular-nums text-[#667085]">
                  {formatTimestamp(item.dueDate)}
                </p>
              ) : (
                <p className="text-[11px] text-[#98a2b3]">
                  No time was promised
                </p>
              )}
            </div>

            <div>
              <p className="mb-1 text-[9.5px] font-bold uppercase tracking-wide text-[#98a2b3]">
                Assignee
              </p>
              <AssigneeLine item={item} users={users} />
            </div>

            {/* Row 52. A Service field set per task type, which no endpoint
                returns. Rendered, not hidden, so the gap is visible. */}
            <div>
              <p className="mb-1 text-[9.5px] font-bold uppercase tracking-wide text-[#98a2b3]">
                {intentLabel(item.intentCode, taxonomy)} details
              </p>
              <LockedNote reason="No per-intent fact fields exist on action items yet, so the specific ask beyond the description is not stored." />
            </div>

            <ActivityTrail item={item} users={users} />
          </div>
        </div>

        {/* Row 51. A ready reply in one tap, which needs a draft to exist. */}
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-[#fafafa] px-2.5 py-2">
          <span className="text-[#98a2b3]">
            <PiRobotBold size={13} />
          </span>
          <span className="text-[11px] font-semibold text-[#667085]">
            AI-drafted reply
          </span>
          <span className="ml-auto">
            <LockedNote reason="No draft field exists on action items, so there is no reply to send. The metrics endpoint returns draftReady as null for the same reason." />
          </span>
        </div>
      </div>

      {pending === 'resolve' ? (
        <ResolvePicker
          busy={busy}
          onCancel={() => setPending(null)}
          onResolve={(type, note) => {
            setPending(null);
            onResolve(item, type, note);
          }}
        />
      ) : pending === 'assign' ? (
        <AssignPicker
          users={users}
          busy={busy}
          onCancel={() => setPending(null)}
          onAssign={(userId) => {
            setPending(null);
            onAssign(item, userId);
          }}
        />
      ) : pending === 'incorrect' ? (
        <IncorrectPicker
          taxonomy={taxonomy}
          busy={busy}
          onCancel={() => setPending(null)}
          onMark={(reason, correctedIntentCode) => {
            setPending(null);
            onMarkIncorrect(item, reason, correctedIntentCode);
          }}
        />
      ) : (
        <div className="flex items-center gap-2 border-t border-[#eceef2] px-4 py-3">
          <PrimaryButton
            className="h-8 flex-1"
            disabled={busy}
            onClick={() => setPending('resolve')}
          >
            <PiCheckCircleBold size={14} /> Resolve
          </PrimaryButton>
          <SecondaryButton
            className="h-8"
            disabled={busy}
            onClick={() => setPending('assign')}
          >
            <PiUserPlusBold size={13} /> Assign
          </SecondaryButton>
          <SecondaryButton
            className="h-8"
            disabled={busy}
            onClick={() => setPending('incorrect')}
          >
            <PiFlagBold size={13} /> Incorrect
          </SecondaryButton>
        </div>
      )}
    </div>
  );
};

/* ── The pane ────────────────────────────────────────────────────── */

const ViniActionItemsDetail: React.FC<{
  items: ViniActionItem[];
  taxonomy: ViniIntentTaxonomy;
  users: ViniActionItemsUser[];
  title: React.ReactNode;
  subtitle: string;
  busy: boolean;
  /** Only offered when every item in the pane is the same customer. */
  onResolveAll?: () => void;
  onResolve: (
    item: ViniActionItem,
    type: ViniResolutionType,
    note: string
  ) => void;
  onAssign: (item: ViniActionItem, userId: string) => void;
  onMarkIncorrect: (
    item: ViniActionItem,
    reason: ViniIncorrectReason,
    correctedIntentCode?: string
  ) => void;
  onOpenCustomer: (customerId: string) => void;
  onOpenCall: (item: ViniActionItem) => void;
  onOpenConversation: (item: ViniActionItem) => void;
}> = ({
  items,
  taxonomy,
  users,
  title,
  subtitle,
  busy,
  onResolveAll,
  onResolve,
  onAssign,
  onMarkIncorrect,
  onOpenCustomer,
  onOpenCall,
  onOpenConversation,
}) => {
  if (items.length === 0) {
    return (
      <div className={cx(CARD, 'flex min-h-[280px] flex-col')}>
        <EmptyPanel
          icon={<PiChecksBold size={22} />}
          title="Pick something from the queue"
          body="Open a row to see what the customer needs and resolve it here."
          className="flex-1"
        />
      </div>
    );
  }

  const sameCustomer = items.every(
    (item) => item.customerId === items[0].customerId
  );

  return (
    <div className={cx(CARD, 'flex min-h-0 flex-col p-0')}>
      <div className="flex flex-none items-center justify-between gap-2 border-b border-[#eceef2] px-5 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">{title}</div>
          <p className="mt-0.5 text-[11px] tabular-nums text-[#98a2b3]">
            {subtitle}
          </p>
        </div>
        {onResolveAll && items.length > 1 && sameCustomer ? (
          <SecondaryButton
            className="h-8"
            disabled={busy}
            onClick={onResolveAll}
          >
            <PiChecksBold size={13} /> Resolve all {items.length}
          </SecondaryButton>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
        {items.map((item) => (
          <ViniActionItemCard
            key={item.actionItemId}
            item={item}
            taxonomy={taxonomy}
            users={users}
            showCustomer={!sameCustomer}
            busy={busy}
            onResolve={onResolve}
            onAssign={onAssign}
            onMarkIncorrect={onMarkIncorrect}
            onOpenCustomer={onOpenCustomer}
            onOpenCall={onOpenCall}
            onOpenConversation={onOpenConversation}
          />
        ))}
      </div>
    </div>
  );
};

export default ViniActionItemsDetail;
