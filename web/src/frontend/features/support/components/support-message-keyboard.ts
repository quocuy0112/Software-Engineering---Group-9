type SupportMessageKeyEvent = {
  key: string;
  shiftKey: boolean;
  nativeEvent: { isComposing?: boolean };
  preventDefault(): void;
};

export function handleSupportMessageKeyDown(
  event: SupportMessageKeyEvent,
  send: () => void,
) {
  if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing)
    return;
  event.preventDefault();
  send();
}
