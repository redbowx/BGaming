function preventContextMenu(event: MouseEvent): void {
  event.preventDefault();
}

export function disableContextMenu(): void {
  document.addEventListener("contextmenu", preventContextMenu);
}
