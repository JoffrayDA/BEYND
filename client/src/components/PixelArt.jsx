import React from 'react';
import { pixels } from './sprites.js';

// Renders sprite layers (sprites.js) as crisp SVG pixels.
export function PixelArt({ layers, size = 64, label = null, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" shapeRendering="crispEdges" style={style}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}>
      {pixels(layers).map(([x, y, fill]) => <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={fill} />)}
    </svg>
  );
}
