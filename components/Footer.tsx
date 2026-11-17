import React from 'react';
import { Phone, Mail, MapPin, Facebook, Instagram, Map } from 'lucide-react';
import { PHONE_NUMBER, EMAIL, GOOGLE_MAPS_LINK, FACEBOOK_LINK, INSTAGRAM_LINK, WHATSAPP_LINK } from '../constants';
import { Logo } from './Logo';

export const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer id="contact" className="bg-taxi-dark text-gray-300 scroll-mt-24 border-t border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          
          {/* Brand */}
          <div>
            <div className="mb-6">
              <Logo className="h-16 md:h-24" variant="light" />
            </div>
            <p className="text-gray-400 mb-6 max-w-xs">
              Your trusted partner for safe, reliable, and professional transportation across Lebanon. Available 24/7.
            </p>
            <div className="flex space-x-4">
              <a href={FACEBOOK_LINK} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors">
                <span className="sr-only">Facebook</span>
                <Facebook className="h-6 w-6" />
              </a>
              <a href={INSTAGRAM_LINK} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors">
                <span className="sr-only">Instagram</span>
                <Instagram className="h-6 w-6" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-white font-semibold text-lg mb-6">Service Areas</h3>
            <ul className="space-y-3">
              <li className="flex items-center gap-2"><MapPin className="w-4 h-4 text-taxi-yellow"/> Beirut</li>
              <li className="flex items-center gap-2"><MapPin className="w-4 h-4 text-taxi-yellow"/> Jounieh</li>
              <li className="flex items-center gap-2"><MapPin className="w-4 h-4 text-taxi-yellow"/> Byblos</li>
              <li className="flex items-center gap-2"><MapPin className="w-4 h-4 text-taxi-yellow"/> Airport Transfers</li>
              <li className="flex items-center gap-2"><MapPin className="w-4 h-4 text-taxi-yellow"/> All Over Lebanon</li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-white font-semibold text-lg mb-6">Contact Us</h3>
            <ul className="space-y-4">
              <li>
                <a
                  href={WHATSAPP_LINK}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-start gap-3 hover:text-white transition-colors group text-left"
                >
                  <Phone className="w-5 h-5 text-taxi-yellow mt-1 group-hover:scale-110 transition-transform" />
                  <span>
                    <span className="block text-white font-medium">Book on WhatsApp</span>
                    {PHONE_NUMBER}
                  </span>
                </a>
              </li>
              <li>
                <a href={`mailto:${EMAIL}`} className="flex items-start gap-3 hover:text-white transition-colors group">
                  <Mail className="w-5 h-5 text-taxi-yellow mt-1 group-hover:scale-110 transition-transform" />
                  <span>
                    <span className="block text-white font-medium">Email Us</span>
                    {EMAIL}
                  </span>
                </a>
              </li>
              <li>
                <a href={GOOGLE_MAPS_LINK} target="_blank" rel="noopener noreferrer" className="flex items-start gap-3 hover:text-white transition-colors group">
                  <Map className="w-5 h-5 text-taxi-yellow mt-1 group-hover:scale-110 transition-transform" />
                  <span>
                    <span className="block text-white font-medium">Our Location</span>
                    View on Google Maps
                  </span>
                </a>
              </li>
            </ul>
          </div>

        </div>

        <div className="border-t border-gray-800 mt-12 pt-8 text-sm text-center text-gray-500">
          <p>&copy; {currentYear} Andrew's Taxi Lebanon. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};