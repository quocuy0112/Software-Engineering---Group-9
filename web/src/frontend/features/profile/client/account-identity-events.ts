export const ACCOUNT_NAME_UPDATED_EVENT = "smarthire:account-name-updated";

export type AccountNameUpdatedDetail = {
  name: string;
};

export function notifyAccountNameUpdated(name: string) {
  window.dispatchEvent(
    new CustomEvent<AccountNameUpdatedDetail>(ACCOUNT_NAME_UPDATED_EVENT, {
      detail: { name },
    }),
  );
}
