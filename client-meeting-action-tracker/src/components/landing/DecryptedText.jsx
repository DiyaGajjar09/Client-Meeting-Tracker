import { useState, useEffect } from 'react';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()';

export default function DecryptedText({
  text,
  speed = 40,
  maxIterations = 10,
  sequential = true,
  className = '',
  parentClassName = '',
  animateOn = 'hover', // 'hover' or 'view'
}) {
  const [displayText, setDisplayText] = useState(text);
  const [isHovering, setIsHovering] = useState(false);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    let interval;
    let iteration = 0;

    if ((animateOn === 'view' && !hasAnimated) || (animateOn === 'hover' && isHovering)) {
      interval = setInterval(() => {
        setDisplayText(() => {
          return text
            .split('')
            .map((char, index) => {
              if (char === ' ') return ' ';
              if (sequential) {
                if (index < iteration / 2) return text[index];
              } else {
                if (iteration > maxIterations) return text[index];
              }
              return LETTERS[Math.floor(Math.random() * LETTERS.length)];
            })
            .join('');
        });

        if (iteration >= (sequential ? text.length * 2 : maxIterations)) {
          setDisplayText(text);
          clearInterval(interval);
          if (animateOn === 'view') setHasAnimated(true);
        }

        iteration += 1;
      }, speed);
    } else {
      setDisplayText(text);
    }

    return () => clearInterval(interval);
  }, [text, isHovering, hasAnimated, animateOn, speed, maxIterations, sequential]);

  return (
    <span
      className={parentClassName}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      style={{ display: 'inline-block', cursor: 'default' }}
    >
      <span className={className}>{displayText}</span>
    </span>
  );
}

