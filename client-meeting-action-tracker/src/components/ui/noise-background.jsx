import React from 'react';

/**
 * Aceternity UI — Noise Background Component
 * Combines dynamic shifting gradients with tactile SVG Perlin noise texture.
 */
export const NoiseBackground = ({
  children,
  className = '',
  containerClassName = '',
  gradientColors = [
    'rgb(99, 102, 241)',
    'rgb(168, 85, 247)',
    'rgb(236, 72, 153)',
  ],
  noiseIntensity = 0.25,
  speed = 0.1,
  animating = true,
  style = {},
  ...props
}) => {
  return (
    <div
      className={`noise-background-container ${containerClassName}`}
      style={{
        position: 'relative',
        overflow: 'hidden',
        ...style,
      }}
      {...props}
    >
      {/* Animated Gradient Layer */}
      <div
        className="noise-gradient-layer"
        style={{
          position: 'absolute',
          inset: '-20%',
          zIndex: 0,
          pointerEvents: 'none',
          background: `radial-gradient(circle at 30% 30%, ${gradientColors[0]} 0%, transparent 60%),
                       radial-gradient(circle at 70% 70%, ${gradientColors[1]} 0%, transparent 60%),
                       radial-gradient(circle at 50% 50%, ${gradientColors[2] || gradientColors[0]} 0%, transparent 70%)`,
          filter: 'blur(20px)',
          animation: animating ? 'aceternityGradientSpin 10s ease-in-out infinite alternate' : 'none',
          opacity: 0.85,
        }}
      />

      {/* SVG Noise Texture Overlay */}
      <div
        className="noise-overlay-layer"
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 1,
          pointerEvents: 'none',
          opacity: noiseIntensity,
          mixBlendMode: 'overlay',
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          backgroundSize: '160px 160px',
        }}
      />

      {/* Content */}
      <div
        className={`noise-content-layer ${className}`}
        style={{ position: 'relative', zIndex: 2 }}
      >
        {children}
      </div>
    </div>
  );
};

export default NoiseBackground;
