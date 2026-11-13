import { dispatch } from '@revolist/revogrid';
const POPUP_OPEN_EVENT = 'popup-open';
type PopupOpenEventDetail = { source: object };

export type PopupOwner = object;

/**
 * Announces a transient popup opening within one grid.
 * Popup owners subscribed to the same grid close unless they sent the event.
 */
export function announcePopupOpen(revogrid: HTMLRevoGridElement, source: PopupOwner) {
  dispatch<PopupOpenEventDetail>(revogrid, POPUP_OPEN_EVENT, { source });
}

/**
 * Subscribes a transient popup owner to other popup openings in the same grid.
 */
export function subscribeToPopupOpen(revogrid: HTMLRevoGridElement, source: PopupOwner, close: () => void) {
  const onPopupOpen = (event: CustomEvent<PopupOpenEventDetail>) => {
    if (event.detail.source !== source) {
      close();
    }
  };

  revogrid.addEventListener(POPUP_OPEN_EVENT, onPopupOpen);
  return () => revogrid.removeEventListener(POPUP_OPEN_EVENT, onPopupOpen);
}
