import { VIEWS } from '@proton/shared/lib/calendar/constants';
import { differenceInCalendarDays, differenceInCalendarWeeks } from '@proton/shared/lib/date-fns-utc';

import { TYPE } from '../../components/calendar/interactions/constants';
import { EventTargetAction } from './interface';

export const getInitialTargetEventData = (
    eventTargetAction: EventTargetAction | undefined,
    dateRange: [Date, Date],
    view: VIEWS
) => {
    if (!eventTargetAction) {
        return;
    }

    const { id, isAllDay, isAllPartDay, startInTzid, preventPopover } = eventTargetAction;
    const [startDateRange, endDateRange] = dateRange;

    if (view === VIEWS.MONTH) {
        return {
            targetEventData: {
                id,
                type: TYPE.DAYGRID,
                idx: differenceInCalendarWeeks(startInTzid, startDateRange),
                preventPopover,
            },
        };
    }

    const isDayGrid = isAllDay || isAllPartDay;

    const getTimeGridIdx = () => {
        if (startDateRange > startInTzid || startInTzid > endDateRange) {
            return 0;
        }
        return differenceInCalendarDays(startInTzid, startDateRange);
    };

    return {
        targetEventData: {
            id,
            type: isDayGrid ? TYPE.DAYGRID : TYPE.TIMEGRID,
            // Assuming week view is always displayed, so not trying to calculate the idx
            idx: isDayGrid ? 0 : getTimeGridIdx(),
            preventPopover,
        },
    };
};
