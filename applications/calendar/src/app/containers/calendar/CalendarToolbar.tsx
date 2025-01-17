import { ReactNode, useRef } from 'react';

import { Vr } from '@proton/atoms';
import { TimeZoneSelector, Toolbar, useElementBreakpoints } from '@proton/components';

interface Props {
    dateCursorButtons?: ReactNode;
    viewSelector?: ReactNode;
    searchButton?: ReactNode;
    searchField?: ReactNode;
    date?: Date;
    telemetrySource?: string;
    timezone?: string;
    setTzid: (tzid: string) => void;
    hideTimeZoneSelector?: boolean;
}

const BREAKPOINTS = {
    extratiny: 200,
    tiny: 350,
    small: 550,
    medium: 700,
    large: 1100,
};

const CalendarToolbar = ({
    dateCursorButtons,
    viewSelector,
    searchButton,
    searchField,
    date,
    timezone,
    hideTimeZoneSelector = false,
    setTzid,
}: Props) => {
    const toolbarRef = useRef<HTMLDivElement>(null);
    const breakpoint = useElementBreakpoints(toolbarRef, BREAKPOINTS);
    const responsiveTimeZoneSelector = !(breakpoint === 'extratiny' || breakpoint === 'tiny');

    return (
        <div className="w100" ref={toolbarRef}>
            <Toolbar className="toolbar--in-container">
                {dateCursorButtons}
                {searchField}

                <span className="md:ml-auto md:flex-item-fluid flex flex-nowrap flex-justify-end">
                    {searchButton && (
                        <>
                            <Vr className="mx-1 no-tablet no-desktop" />
                            {searchButton}
                            <Vr className="ml-1 no-mobile" />
                        </>
                    )}
                    {!hideTimeZoneSelector && responsiveTimeZoneSelector ? (
                        <div className="flex flex-nowrap no-mobile no-tablet">
                            <TimeZoneSelector
                                data-testid="calendar-view:time-zone-dropdown"
                                className="wauto toolbar-button"
                                date={date}
                                timezone={timezone}
                                onChange={setTzid}
                                telemetrySource="temporary_timezone"
                                abbreviatedTimezone={breakpoint === 'small' ? 'offset' : undefined}
                            />
                            <Vr />
                        </div>
                    ) : undefined}
                </span>
                <span className="flex no-mobile flex-item-noshrink ml-auto lg:ml-1">{viewSelector}</span>
            </Toolbar>
        </div>
    );
};

export default CalendarToolbar;
