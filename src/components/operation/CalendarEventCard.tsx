import { Budget } from '@/types/crm';
import { Appointment, APPOINTMENT_KIND_COLORS, APPOINTMENT_KIND_LABELS } from '@/types/appointment';
import { useCRM } from '@/contexts/CRMContext';
import { cn } from '@/lib/utils';
import { useDraggable } from '@dnd-kit/core';
import { format } from 'date-fns';
import { Package } from 'lucide-react';
import type { MemberColor } from '@/utils/memberColors';

export type CalendarEventType = 'execution' | 'delivery' | 'pending' | 'appointment' | 'activity';

export interface CalendarDeliveryEvent {
  id: string;
  date: Date;
  label: string;
  budget: Budget;
  type: 'delivery';
  serviceId?: string;
}

export interface CalendarActivityEvent {
  id: string;
  activityId: string;
  date: Date;
  title: string;
  status: string;
  budget: Budget;
  projectCardId: string;
  isDelivery?: boolean;
  isCaptacao?: boolean;
  /** "HH:MM" when the activity has a set time */
  startTime?: string;
  /** User id whose color should be used to render this event. */
  assignedUserId?: string;
}

interface CalendarEventCardProps {
  /** Stable id used for drag identification */
  dragId?: string;
  /** Drag payload that the page-level handler will use to persist changes. */
  dragData?: Record<string, any>;
  budget?: Budget;
  appointment?: Appointment;
  activity?: CalendarActivityEvent;
  compact?: boolean;
  onClick?: () => void;
  eventType?: CalendarEventType;
  deliveryLabel?: string;
  disableDrag?: boolean;
  /** Optional per-person color override (used by team/personal calendars). */
  memberColor?: MemberColor | null;
}

export function CalendarEventCard({
  dragId,
  dragData,
  budget,
  appointment,
  activity,
  compact = false,
  onClick,
  eventType = 'execution',
  deliveryLabel,
  disableDrag,
  memberColor,
}: CalendarEventCardProps) {
  const { clients } = useCRM();
  const client = budget ? clients.find(c => c.id === budget.clientId) : null;

  const draggable = useDraggable({
    id: dragId || `static-${Math.random()}`,
    data: dragData,
    disabled: disableDrag || !dragId,
  });

  const isDelivery = eventType === 'delivery';
  const isPending = eventType === 'pending';
  const isAppointment = eventType === 'appointment';
  const isActivity = eventType === 'activity';

  const apptColors = appointment ? APPOINTMENT_KIND_COLORS[appointment.kind] : null;

  const activityIsDelivery = isActivity && !!activity?.isDelivery;
  const showDeliveryIcon = isDelivery || activityIsDelivery;

  const statusStyle = memberColor && !isAppointment
    ? cn(memberColor.bg, memberColor.border, memberColor.text)
    : isAppointment && apptColors
    ? cn(apptColors.bg, apptColors.border, apptColors.text)
    : isDelivery || activityIsDelivery
      ? 'bg-blue-500/15 border-blue-500/30 text-blue-600'
      : isActivity
        ? 'bg-green-500/15 border-green-500/30 text-green-700 dark:text-green-300'
      : isPending
        ? 'bg-yellow-500/15 border-yellow-500/30 text-yellow-600'
        : 'bg-success/15 border-success/30 text-success';

  const dotColor = memberColor && !isAppointment
    ? memberColor.dot
    : isAppointment && apptColors
    ? apptColors.dot
    : isDelivery || activityIsDelivery ? 'bg-blue-500'
    : isActivity ? 'bg-green-500'
    : isPending ? 'bg-yellow-500'
    : 'bg-success';

  // Build label
  let mainLabel = '';
  let secondaryLabel = '';
  let timeLabel = '';
  if (isAppointment && appointment) {
    if (!appointment.allDay) timeLabel = format(appointment.startAt, 'HH:mm');
    mainLabel = appointment.title;
  } else if (isActivity && activity) {
    if (activity.startTime) timeLabel = activity.startTime;
    mainLabel = `${budget?.proposalId || ''} - ${budget?.projectName || ''}`.replace(/^ - /, '');
    secondaryLabel = `✓ ${activity.title}`;
  } else if (isDelivery) {
    mainLabel = deliveryLabel || '';
  } else if (budget) {
    if (budget.executionStartTime) timeLabel = budget.executionStartTime;
    mainLabel = `${budget.proposalId} - ${budget.projectName}`;
  }

  const dragStyle = draggable.transform
    ? {
        transform: `translate3d(${draggable.transform.x}px, ${draggable.transform.y}px, 0)`,
        opacity: 0.85,
        zIndex: 50,
      }
    : undefined;

  const isCaptacao = isActivity && !!activity?.isCaptacao;

  const baseClasses = cn(
    'w-full text-left border transition-opacity active:scale-[0.97]',
    statusStyle,
    isCaptacao && 'border-l-4 !border-l-red-500',
    !disableDrag && dragId && 'cursor-grab active:cursor-grabbing',
    draggable.isDragging && 'opacity-50',
  );

  if (compact) {
    return (
      <button
        ref={draggable.setNodeRef as any}
        style={dragStyle}
        {...draggable.listeners}
        {...draggable.attributes}
        onClick={(e) => { if (!draggable.isDragging) onClick?.(); e.stopPropagation(); }}
        className={cn(baseClasses, 'px-1.5 py-0.5 rounded text-[10px] leading-tight font-semibold hover:opacity-80', isActivity ? 'block' : 'flex items-center gap-1 truncate')}
      >
        {isActivity ? (
          <>
            <div className="flex items-center gap-1 truncate">
              <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', dotColor)} />
              {showDeliveryIcon && <Package className="w-3 h-3 shrink-0" />}
              <span className="truncate text-foreground">{mainLabel}</span>
            </div>
            <div className="truncate text-foreground/80 pl-2.5 font-medium">{secondaryLabel}</div>
          </>
        ) : (
          <>
            <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', dotColor)} />
            {showDeliveryIcon && <Package className="w-3 h-3 shrink-0" />}
            {timeLabel && <span className="text-foreground/70 font-semibold shrink-0">{timeLabel}</span>}
            <span className="truncate text-foreground">{mainLabel}</span>
          </>
        )}
      </button>
    );
  }

  return (
    <button
      ref={draggable.setNodeRef as any}
      style={dragStyle}
      {...draggable.listeners}
      {...draggable.attributes}
      onClick={(e) => { if (!draggable.isDragging) onClick?.(); e.stopPropagation(); }}
      className={cn(baseClasses, 'px-2 py-1.5 rounded-md shadow-sm hover:shadow-md space-y-0.5')}
      title={isAppointment && appointment ? APPOINTMENT_KIND_LABELS[appointment.kind] : undefined}
    >
      <div className="flex items-center gap-1.5">
        <span className={cn('w-2 h-2 rounded-full shrink-0', dotColor)} />
        {showDeliveryIcon && <Package className="w-3.5 h-3.5 shrink-0" />}
        {timeLabel && <span className="text-foreground/70 text-[11px] font-semibold shrink-0">{timeLabel}</span>}
        <span className="text-xs font-semibold truncate text-foreground">{mainLabel}</span>
      </div>
      {isAppointment && appointment?.location && (
        <p className="text-[10px] text-muted-foreground truncate pl-3.5">{appointment.location}</p>
      )}
      {isActivity && activity && (
        <p className="text-[10px] text-muted-foreground truncate pl-3.5">{secondaryLabel}</p>
      )}
      {!isAppointment && !isActivity && client && (
        <p className="text-[10px] text-muted-foreground truncate pl-3.5">{client.companyName}</p>
      )}
    </button>
  );
}
