// frontend/(protected)/dashboard/modules/admissions/components/FeePaymentForm.tsx
import { useState } from 'react';

const FeePaymentForm = ({ payments, onPaymentsChange }: { payments: any[]; onPaymentsChange: (payments: any[]) => void }) => {
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState('');

  const addPayment = () => {
    if (amount > 0 && method) {
      const newPayments = [...payments, { amount, payment_method: method }];
      onPaymentsChange(newPayments);
      setAmount(0);
      setMethod('');
    }
  };

  return (
    <div className="space-y-2">
      <label>Add Fee Payment</label>
      <input
        type="number"
        value={amount}
        onChange={(e) => setAmount(Number(e.target.value))}
        placeholder="Amount"
        className="p-2 border rounded"
      />
      <input
        type="text"
        value={method}
        onChange={(e) => setMethod(e.target.value)}
        placeholder="Method (e.g., Cash)"
        className="p-2 border rounded"
      />
      <button type="button" onClick={addPayment} className="bg-blue-500 text-white px-2 py-1 rounded">Add</button>
      <ul>{payments.map((p, i) => <li key={i}>${p.amount} via {p.payment_method}</li>)}</ul>
    </div>
  );
};

export default FeePaymentForm;