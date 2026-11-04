export interface Rect {
  top: number;
  left: number;
  bottom: number;
  right: number;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Viewport {
  width: number;
  height: number;
}

export interface PopoverPlacement {
  isSheet: boolean;
  x: number;
  y: number;
  width?: number;
  height?: number;
}

export const SHEET_MAX_VIEWPORT_WIDTH = 480;

/**
 * Computes viewport-relative placement for a popover anchored to an element.
 * - Under 480px width: switches to bottom sheet.
 * - Desktop/tablet: opens below anchor; flips above if bottom overflows; clamps within viewport with margin.
 */
export function placePopover(
  anchor: Rect,
  size: Size,
  viewport: Viewport,
  margin = 8
): PopoverPlacement {
  if (viewport.width < SHEET_MAX_VIEWPORT_WIDTH) {
    return {
      isSheet: true,
      x: margin,
      y: viewport.height - size.height - margin,
      width: viewport.width - margin * 2,
    };
  }

  // Try placing below anchor
  let y = anchor.bottom + margin;
  if (y + size.height > viewport.height - margin) {
    const flippedY = anchor.top - size.height - margin;
    if (flippedY >= margin) {
      y = flippedY;
    } else {
      y = Math.max(margin, viewport.height - size.height - margin);
    }
  }

  // Align with anchor right, clamp within viewport
  let x = anchor.right - size.width;
  if (x < margin) {
    x = margin;
  } else if (x + size.width > viewport.width - margin) {
    x = Math.max(margin, viewport.width - size.width - margin);
  }

  return {
    isSheet: false,
    x,
    y,
    width: size.width,
    height: size.height,
  };
}
