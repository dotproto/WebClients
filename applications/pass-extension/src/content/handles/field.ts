import { fathom } from '@proton/pass/fathom/protonpass-fathom';
import { findBoundingElement, isInputElement } from '@proton/pass/utils/dom';
import { createListenerStore } from '@proton/pass/utils/listener';
import noop from '@proton/utils/noop';

import { autofill } from '../../shared/form';
import CSContext from '../context';
import { DropdownAction, FieldHandles, FormField, FormFieldTypeMap, FormHandles, FormType } from '../types';
import { createFieldIconHandles } from './icon';

const { isVisible } = fathom.utils;

type CreateFieldHandlesOptions<T extends FormType, V extends FormField> = {
    formType: T;
    fieldType: V;
    getFormHandle: () => FormHandles;
};

export const createFieldHandles =
    <T extends FormType, V extends FormField>({
        formType,
        fieldType,
        getFormHandle,
    }: CreateFieldHandlesOptions<T, V>) =>
    (element: FormFieldTypeMap[V]): FieldHandles => {
        /**
         * Since we're creating "field handles" for elements
         * that may include submit buttons as well : make sure
         * we're dealing with an HTMLInputElement for autofilling
         * and icon injection
         */
        const isInput = isInputElement(element);
        const listeners = createListenerStore();
        const boxElement = findBoundingElement(element);

        const field: FieldHandles = {
            formType,
            fieldType,
            element,
            boxElement,
            icon: null,
            value: element.value ?? '',
            getFormHandle,
            setValue: (value) => (field.value = value),
            autofill: isInput ? autofill(element) : noop,
            attachIcon: (action) => {
                /**
                 * make sure the element is actually visible
                 * as we may have detected a "hidden" field
                 * in order to track it
                 */
                if (isVisible(field.element)) {
                    field.icon = isInput ? createFieldIconHandles({ field }) : null;
                    field.icon?.setOnClickAction(action);
                }
            },
            detachIcon: () => {
                field.icon?.detach();
                field.icon = null;
            },
            attachListeners: (onSubmit) => {
                const onFocus = () =>
                    CSContext.get().iframes.dropdown.open({
                        action: DropdownAction.AUTOFILL,
                        focus: true,
                        field,
                    });

                if (formType === FormType.LOGIN) {
                    if (document.activeElement === field.element) {
                        onFocus();
                    }

                    listeners.addListener(field.element, 'focus', onFocus);
                }

                listeners.addListener(field.element, 'input', () => {
                    const { dropdown } = CSContext.get().iframes;
                    if (dropdown.getState().visible) {
                        dropdown.close();
                    }

                    field.setValue(element.value);
                });

                listeners.addListener(field.element, 'keydown', (e) => {
                    const { key } = e as KeyboardEvent;
                    return key === 'Enter' && onSubmit();
                });
            },
            detachListeners: () => listeners.removeAll(),
        };

        return field;
    };