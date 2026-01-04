import { StudentGuardianLink } from "../guardians/guardian.types";

interface Props {
  links: StudentGuardianLink[];
  onRemove: (linkId: string) => void;
  onEdit?: (link: StudentGuardianLink) => void;
}

export default function GuardianTable({ links, onRemove, onEdit }: Props) {
  return (
    <table className="w-full border rounded-lg overflow-hidden">
      <thead className="bg-gray-100">
        <tr>
          <th className="p-2 text-left">Name</th>
          <th className="p-2 text-left">Phone</th>
          <th className="p-2 text-left">Email</th>
          <th className="p-2 text-left">Relationship</th>
          <th className="p-2"></th>
        </tr>
      </thead>

      <tbody>
        {links.map((link) => {
          const g = link.guardian;

          return (
            <tr key={link.id} className="border-t">
              <td className="p-2">
                <div className="flex items-center gap-2">
                  <span>{g.fullName}</span>

                  {link.isPrimary && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 rounded-full">
                      Primary
                    </span>
                  )}

                  {link.isEmergencyContact && (
                    <span className="text-xs bg-red-100 text-red-700 px-2 rounded-full">
                      Emergency
                    </span>
                  )}
                </div>
              </td>

              <td className="p-2">{g.phone}</td>
              <td className="p-2">{g.email || "-"}</td>
              <td className="p-2">{link.relationship}</td>

              <td className="p-2 flex gap-2">
                {onEdit && (
                  <button
                    className="text-blue-600 hover:underline"
                    onClick={() => onEdit(link)}
                  >
                    Edit
                  </button>
                )}

                <button
                  onClick={() => onRemove(link.id)}
                  className="text-red-600 hover:underline"
                >
                  Remove
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
