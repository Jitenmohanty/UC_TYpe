import React, { useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';

export const FAQSection: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      q: 'How does equipment sanitization and hygiene work?',
      a: 'All tools undergo ultrasonic cleansing and hospital-grade sterilization before every shift. In front of you, the barber will unseal a fresh titanium disposable razor blade and single-use cape. We maintain a strict zero-cross-contamination policy.',
    },
    {
      q: 'What do I need to prepare at home for the appointment?',
      a: 'Just a comfortable chair and a standard power outlet. Your mobile barber arrives with a specialized high-power cordless toolkit, LED ring light, protective floor mat, and vacuum cleanup unit. Your floor is left 100% spotless.',
    },
    {
      q: 'How does the 6-Digit OTP verification handshake protect me?',
      a: 'Once your booking is confirmed, a private 6-digit code is dispatched to your registered phone via Twilio SMS. Your barber cannot start or charge the service until they arrive at your doorstep and you provide the OTP.',
    },
    {
      q: 'What if I need to reschedule or cancel my booking?',
      a: 'You can reschedule or cancel directly from your "My Bookings" dashboard. If a barber has to cancel due to unforeseen traffic or vehicle issues, our algorithm automatically searches and dispatches the nearest available partner without disrupting your schedule.',
    },
    {
      q: 'Are your partner barbers background-checked and certified?',
      a: 'Yes. Every partner barber undergoes police background verification, minimum 4+ years professional salon experience validation, and mandatory hospital-grade hygiene training before being onboarded to Aura Flow.',
    },
  ];

  return (
    <section className="py-24 relative z-10 bg-[#0b0c10] border-t border-white/[0.06]">
      <div className="max-w-4xl mx-auto px-4 md:px-8 space-y-12">
        
        {/* Section Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#ff6c4c]/10 border border-[#ff6c4c]/30 text-[#ff8a6a] text-xs font-bold">
            <HelpCircle className="w-3.5 h-3.5 text-[#ff6c4c]" />
            <span>Frequently Asked Questions</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold font-outfit text-white">
            Everything You <span className="gradient-text-flow font-editorial italic font-normal">Need to Know</span>
          </h2>
          <p className="text-gray-400 text-sm sm:text-base font-normal">
            Have questions about doorstep grooming? Here are the answers to the most common inquiries.
          </p>
        </div>

        {/* Accordion List */}
        <div className="space-y-4">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <div
                key={index}
                className={`glass-card rounded-2xl border transition-all duration-200 overflow-hidden ${
                  isOpen ? 'border-[#ff6c4c]/40 bg-[#141724]' : 'border-white/[0.08] hover:border-white/[0.15]'
                }`}
              >
                <button
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  className="w-full p-5 sm:p-6 text-left flex items-center justify-between gap-4"
                >
                  <span className="font-extrabold text-sm sm:text-base text-white">
                    {faq.q}
                  </span>
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center transition-transform shrink-0 ${
                      isOpen ? 'bg-[#ff6c4c] text-white rotate-180' : 'bg-white/[0.04] text-gray-400'
                    }`}
                  >
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </button>

                {isOpen && (
                  <div className="px-5 sm:px-6 pb-6 pt-1 text-xs sm:text-sm text-gray-300 leading-relaxed border-t border-white/[0.06] animate-fade-in font-normal">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
};
