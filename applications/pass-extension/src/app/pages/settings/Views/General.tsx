import { type VFC } from 'react';
import { useDispatch } from 'react-redux';

import { ApplicationLogs } from 'proton-pass-extension/lib/components/Settings/ApplicationLogs';
import { Behaviors } from 'proton-pass-extension/lib/components/Settings/Behaviors';
import { Locale } from 'proton-pass-extension/lib/components/Settings/Locale';
import { SettingsPanel } from 'proton-pass-extension/lib/components/Settings/SettingsPanel';
import { VaultSetting } from 'proton-pass-extension/lib/components/Settings/VaultSetting';
import { c } from 'ttag';

import { useFeatureFlag } from '@proton/pass/hooks/useFeatureFlag';
import { vaultSetPrimaryIntent } from '@proton/pass/store/actions';
import { selectDefaultVault, selectOwnWritableVaults } from '@proton/pass/store/selectors';
import { PassFeature } from '@proton/pass/types/api/features';

export const General: VFC = () => {
    const dispatch = useDispatch();
    const primaryVaultDisabled = useFeatureFlag(PassFeature.PassRemovePrimaryVault);

    return (
        <>
            <Locale />
            {!primaryVaultDisabled && (
                <SettingsPanel title={c('Label').t`Vaults`}>
                    <VaultSetting
                        label={c('Label').t`Primary vault`}
                        optionsSelector={selectOwnWritableVaults}
                        valueSelector={selectDefaultVault}
                        onSubmit={({ shareId, content }) =>
                            dispatch(vaultSetPrimaryIntent({ id: shareId, name: content.name }))
                        }
                    />
                </SettingsPanel>
            )}
            <Behaviors />
            <ApplicationLogs />
        </>
    );
};
