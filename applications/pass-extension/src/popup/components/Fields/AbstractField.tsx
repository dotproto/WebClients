import type { ReactNode } from 'react';

import type { FieldProps } from 'formik';

import { InputControlProps } from '../Controls/InputControl';

export type AbstractFieldProps<T extends InputControlProps> = T & FieldProps;

export const AbstractField = <T extends InputControlProps>(
    props: AbstractFieldProps<T> & { children: (props: T) => ReactNode }
) => {
    const { field, form, meta, children, ...rest } = props;

    const { name } = field;
    const { touched, errors } = form;
    const error = touched[name] && errors[name];
    const status = error ? 'error' : 'default';
    const inputControlProps = { ...rest, ...field, status, error } as InputControlProps;

    return <>{children(inputControlProps)}</>;
};