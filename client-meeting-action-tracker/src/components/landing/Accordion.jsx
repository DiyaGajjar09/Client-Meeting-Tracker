import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export default function Accordion({ items }) {
  const [openIndex, setOpenIndex] = useState(0);

  const toggle = (idx) => {
    setOpenIndex(openIndex === idx ? -1 : idx);
  };

  return (
    <div className="faq-list">
      {items.map((item, idx) => {
        const isOpen = openIndex === idx;
        return (
          <div key={idx} className={`faq-item ${isOpen ? 'active' : ''}`}>
            <button
              className="faq-button"
              onClick={() => toggle(idx)}
              aria-expanded={isOpen}
            >
              <span>{item.question}</span>
              <ChevronDown size={18} className="faq-icon" />
            </button>
            {isOpen && (
              <div className="faq-content animate-fadeIn">
                <p>{item.answer}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

