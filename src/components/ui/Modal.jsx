import Card from './Card';
import { XCircle } from 'lucide-react';

export default function Modal({ children, onClose, maxWidth = 'max-w-lg' }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 p-4">
      <div className={`relative w-full ${maxWidth}`}>
        <Card className="w-full">
          {children}
        </Card>
        <button
          onClick={onClose}
          className="absolute -top-2 -right-2 text-white bg-pink-500 rounded-full p-1 hover:bg-pink-600 transition"
        >
          <XCircle size={28} />
        </button>
      </div>
    </div>
  );
}