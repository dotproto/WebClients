import { useRef } from 'react';

import { FieldArray, type FormikContextType, type FormikErrors } from 'formik';
import { c } from 'ttag';
import uniqid from 'uniqid';

import { Button } from '@proton/atoms';
import { Icon, InputFieldTwo } from '@proton/components/';
import { isEmptyString } from '@proton/pass/utils/string';
import { isValidURL } from '@proton/pass/utils/url';

import { FieldsetCluster } from '../Controls/FieldsetCluster';
import { CustomInputControl } from '../Controls/InputControl';
import { InputGroup } from '../Controls/InputGroup';

type UrlItem = { url: string; id: string };

export type UrlGroupValues = {
    url: string;
    urls: UrlItem[];
};

type UrlGroupProps<V extends UrlGroupValues = UrlGroupValues> = {
    form: FormikContextType<V>;
};

export const createNewUrl = (url: string) => ({
    id: uniqid(),
    url: isValidURL(url).url,
});

export const validateUrl = <V extends UrlGroupValues>({ url, urls }: V) => {
    if (!isEmptyString(url)) {
        const { valid: validURL, url: safeUrl } = isValidURL(url);
        const urlExists = urls.map(({ url }) => url).includes(safeUrl);

        if (!validURL) {
            return { url: c('Validation').t`Url is invalid` };
        }

        if (urlExists) {
            return { url: c('Validation').t`Url already exists` };
        }
    }

    return {};
};

export const validateUrls = <V extends UrlGroupValues>({ urls }: V) => {
    const urlsErrors = urls.map(({ url }) => {
        const isEmpty = isEmptyString(url);
        const { valid: validURL } = isValidURL(url);

        if (isEmpty) {
            return { url: c('Validation').t`Url cannot be empty` };
        }

        if (!validURL) {
            return { url: c('Validation').t`Url is invalid` };
        }

        return {};
    });

    return (urlsErrors.some(({ url }) => url !== undefined) ? { urls: urlsErrors } : {}) as FormikErrors<V>;
};

export const UrlGroupFieldCluster = <T extends UrlGroupValues>({ form }: UrlGroupProps<T>) => {
    const { values, errors, handleChange } = form;
    const inputRef = useRef<HTMLInputElement>(null);

    return (
        <FieldsetCluster>
            <InputGroup icon={<Icon name="earth" size={24} style={{ color: 'var(--field-placeholder-color)' }} />}>
                <label
                    htmlFor="next-url-field"
                    className="field-two-label-container flex flex-justify-space-between flex-nowrap flex-align-items-end flex-gap-0-5 color-norm text-normal"
                >
                    <span className="field-two-label">{c('Label').t`Websites`}</span>
                </label>
                <FieldArray
                    name="urls"
                    render={(helpers) => {
                        const handleReplace = (index: number) => (url: string) => {
                            const { id } = values.urls[index];

                            helpers.replace(index, { id, url });
                        };

                        const handleRemove = helpers.handleRemove;

                        const handleAdd = () => {
                            if (values.url && !errors.url) {
                                helpers.push(createNewUrl(values.url));
                                form.setFieldValue('url', '');
                            }

                            inputRef.current?.focus();
                        };

                        return (
                            <ul className="unstyled m0">
                                {values.urls.map(({ url, id }, index) => (
                                    <li key={id}>
                                        <CustomInputControl
                                            actions={
                                                <Button
                                                    icon
                                                    pill
                                                    color="weak"
                                                    shape="ghost"
                                                    size="small"
                                                    title={c('Action').t`Delete`}
                                                    onClick={handleRemove(index)}
                                                >
                                                    <Icon name="cross" />
                                                </Button>
                                            }
                                        >
                                            {(inputProps) => (
                                                <InputFieldTwo
                                                    error={(errors.urls?.[index] as FormikErrors<UrlItem>)?.url}
                                                    onValue={handleReplace(index)}
                                                    onBlur={() =>
                                                        helpers.replace(index, { id, url: isValidURL(url).url })
                                                    }
                                                    value={url}
                                                    unstyled
                                                    assistContainerClassName="hidden-empty"
                                                    inputClassName="color-norm p-0"
                                                    placeholder={c('Placeholder').t`Enter a domain or a URL`}
                                                    {...inputProps}
                                                />
                                            )}
                                        </CustomInputControl>
                                    </li>
                                ))}
                                <CustomInputControl
                                    actions={
                                        <Button
                                            icon
                                            pill
                                            color="weak"
                                            shape="ghost"
                                            size="small"
                                            title={c('Action').t`Add`}
                                            onClick={handleAdd}
                                        >
                                            <Icon name="plus" />
                                        </Button>
                                    }
                                >
                                    {(inputProps) => (
                                        <InputFieldTwo
                                            id="next-url-field"
                                            unstyled
                                            assistContainerClassName="hidden-empty"
                                            inputClassName="color-norm p-0"
                                            placeholder={c('Placeholder').t`Enter a domain or a URL`}
                                            name="url"
                                            value={values.url}
                                            error={errors.url}
                                            onChange={handleChange}
                                            onBlur={() =>
                                                !errors.url && form.setFieldValue('url', isValidURL(values.url).url)
                                            }
                                            ref={inputRef}
                                            {...inputProps}
                                        />
                                    )}
                                </CustomInputControl>
                            </ul>
                        );
                    }}
                />
            </InputGroup>
        </FieldsetCluster>
    );
};