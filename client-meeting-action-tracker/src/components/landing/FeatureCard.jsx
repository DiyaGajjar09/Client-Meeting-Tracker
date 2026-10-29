import { useState, useRef } from 'react';

export default function FeatureCard({ icon: Icon, title, description, tag }) {
  const cardRef = useRef(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  return (
    <div
      ref={cardRef}
      className="feature-card"
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* ReactBits-style Spotlight Glow */}
      {isHovered && (
        <div
          style={{
            position: 'absolute',
            top: mousePos.y - 120,
            left: mousePos.x - 120,
            width: 240,
            height: 240,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(99, 102, 241, 0.18) 0%, transparent 70%)',
            pointerEvents: 'none',
            zIndex: 0,
            transition: 'opacity 0.15s ease',
          }}
        />
      )}

      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div className="feature-icon-box">
            {Icon && <Icon size={20} />}
          </div>
          {tag && (
            <span style={{
              fontSize: '10px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: '#818cf8',
              background: 'rgba(99, 102, 241, 0.12)',
              padding: '2px 8px',
              borderRadius: '9999px',
              border: '1px solid rgba(99, 102, 241, 0.25)',
            }}>
              {tag}
            </span>
          )}
        </div>

        <h3 className="feature-card-title">{title}</h3>
        <p className="feature-card-desc">{description}</p>
      </div>
    </div>
  );
}

