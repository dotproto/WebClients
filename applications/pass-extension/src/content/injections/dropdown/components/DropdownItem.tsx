import React from 'react';

import { c } from 'ttag';

import { DropdownMenuButton, Icon, IconName } from '@proton/components/components';
import { PASS_APP_NAME } from '@proton/shared/lib/constants';

export const DropdownItem: React.FC<{
    onClick?: () => void;
    title: string;
    subTitle: React.ReactNode;
    icon?: IconName;
    disabled?: boolean;
}> = ({ onClick, title, subTitle, icon, disabled }) => {
    return (
        <DropdownMenuButton className="text-left" onClick={onClick} disabled={disabled}>
            <div className="flex flex-align-items-center py0-3">
                {icon !== undefined ? (
                    <Icon name={icon} className="mr1 item-icon" size={24} color="#6D4AFF" />
                ) : (
                    <div className="mr1 w-custom text-align-center" style={{ '--width-custom': '24px' }}>
                        <img
                            src={'/assets/protonpass-icon-32.png'}
                            width={18}
                            height={18}
                            className="ml0-25"
                            alt={c('Action').t`Toggle ${PASS_APP_NAME}`}
                        />
                    </div>
                )}

                <div className="flex-item-fluid">
                    <span className="block text-ellipsis">{title}</span>
                    <span className="block color-weak text-sm text-ellipsis">{subTitle}</span>
                </div>
            </div>
        </DropdownMenuButton>
    );
};