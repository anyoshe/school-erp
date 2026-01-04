import { MedicalRecord } from "./medical.types";

interface Props {
  records: MedicalRecord[];
  onEdit: (record: MedicalRecord) => void;
  onDelete: (id: string) => void;
}

export default function MedicalTable({ records, onEdit, onDelete }: Props) {
  return (
    <table className="w-full">
      <thead>
        <tr>
          <th>Allergies</th>
          <th>Conditions</th>
          <th>Immunization Notes</th>
          <th>Last Visit</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {records.map((r) => (
          <tr key={r.id} className="border-t">
            <td>{r.allergies}</td>
            <td>{r.conditions}</td>
            <td>{r.immunizationNotes}</td>
            <td>{r.lastVisit}</td>
            <td>
              <button
                onClick={() => onEdit(r)}
                className="text-blue-600 mr-2"
              >
                Edit
              </button>
              <button
                onClick={() => onDelete(r.id)}
                className="text-red-600"
              >
                Delete
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
