import { type VFC, useState } from 'react';

import { Field, Form, FormikProvider, useFormik } from 'formik';
import { c } from 'ttag';
import uniqid from 'uniqid';

import { getEpoch } from '@proton/pass/utils/time/get-epoch';

import { TextAreaField, TextField } from '../../../../shared/components/fields';
import { ItemNewProps } from '../../../../shared/items';
import { ItemCreatePanel } from '../../../components/Panel/ItemCreatePanel';
import { usePopupContext } from '../../../context';
import AliasForm from './Alias.form';
import { NewAliasFormValues, validateNewAliasForm } from './Alias.validation';

const FORM_ID = 'new-alias';

export const AliasNew: VFC<ItemNewProps<'alias'>> = ({ vaultId, onSubmit, onCancel }) => {
    const [ready, setReady] = useState(false);

    const { realm, subdomain } = usePopupContext();
    const isValidURL = realm !== undefined;
    const url = subdomain !== undefined ? subdomain : realm;
    const defaultName = isValidURL ? url! : c('Placeholder').t`Unnamed`;

    const form = useFormik<NewAliasFormValues>({
        initialValues: {
            name: defaultName,
            note: isValidURL ? c('Placeholder').t`Used on ${url}` : '',
            shareId: vaultId,
            aliasPrefix: isValidURL ? url : '',
            aliasSuffix: undefined,
            mailboxes: [],
        },
        onSubmit: ({ name, note, shareId, aliasPrefix, aliasSuffix, mailboxes }) => {
            if (aliasPrefix !== undefined && aliasSuffix !== undefined) {
                const optimisticId = uniqid();

                onSubmit({
                    type: 'alias',
                    optimisticId,
                    shareId,
                    createTime: getEpoch(),
                    metadata: {
                        name,
                        note,
                        itemUuid: optimisticId,
                    },
                    content: {},
                    extraFields: [],
                    extraData: {
                        mailboxes,
                        prefix: aliasPrefix,
                        signedSuffix: aliasSuffix.signature,
                        aliasEmail: aliasPrefix + aliasSuffix.value,
                    },
                });
            }
        },
        validate: validateNewAliasForm,
        validateOnChange: true,
    });

    const valid = ready && form.isValid;

    return (
        <ItemCreatePanel type="alias" formId={FORM_ID} handleCancelClick={onCancel} valid={valid}>
            <FormikProvider value={form}>
                <Form id={FORM_ID}>
                    <Field name="name" label={c('Label').t`Name`} component={TextField} />
                    <AliasForm<NewAliasFormValues>
                        form={form}
                        shareId={vaultId}
                        onAliasOptionsLoaded={async (aliasOptions) => {
                            const firstSuffix = aliasOptions.suffixes?.[0];
                            const firstMailBox = aliasOptions.mailboxes?.[0];

                            await form.setValues(
                                (values) => ({
                                    ...values,
                                    ...(firstSuffix !== undefined ? { aliasSuffix: firstSuffix } : {}),
                                    ...(firstMailBox !== undefined ? { mailboxes: [firstMailBox] } : {}),
                                }),
                                true
                            );

                            setReady(true);
                        }}
                    />
                    <br />
                    <Field
                        name="note"
                        label={c('Label').t`Note`}
                        component={TextAreaField}
                        assistContainerClassName="hidden-empty"
                        rows={5}
                    />
                </Form>
            </FormikProvider>
        </ItemCreatePanel>
    );
};