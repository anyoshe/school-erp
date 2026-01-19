// "use client";
// import { useEffect, useState } from "react";
// import Layout from "@/app/(protected)/dashboard/components/layout/Layout";
// import { getUsers, User } from "@/app/(protected)/dashboard/modules/accounts/services";

// export default function UsersPage() {
//   const [users, setUsers] = useState<User[]>([]);
//   const [loading, setLoading] = useState(true);

//   useEffect(() => {
//     const fetchUsers = async () => {
//       try {
//         const data = await getUsers();
//         setUsers(data);
//       } catch (err) {
//         console.error(err);
//       } finally {
//         setLoading(false);
//       }
//     };
//     fetchUsers();
//   }, []);

//   if (loading) return <p>Loading users...</p>;

//   return (
//     <Layout>
//       <h1 className="text-xl font-bold mb-4">Users</h1>
//       <ul>
//         {users.map(user => (
//           <li key={user.id}>
//             {user.email} - {user.role} {user.is_staff ? "(Staff)" : ""}
//           </li>
//         ))}
//       </ul>
//     </Layout>
//   );
// }
