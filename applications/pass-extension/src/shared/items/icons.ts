import { IconName } from '@proton/components/components/icon';
import { Item, ItemMap } from '@proton/pass/types';

export const itemTypeToIconName: ItemMap<IconName> = {
    login: 'user',
    note: 'file-lines',
    alias: 'alias',
};

export const presentItemIcon = (item: Item) => itemTypeToIconName[item.type];