// AttendanceTable.jsx
const AttendanceTable = ({ attendance, loading }) => (
    <div className="bg-white rounded-xl shadow-md overflow-hidden mb-8">
        {loading ? (
            <div className="flex justify-center items-center h-64">Loading...</div>
        ) : (
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            {["Id", "Employee", "Task", "Urgency", "Task Due Date", "Revised Due Date", "Status", ].map((head, i) => (
                                <th key={i} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{head}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {attendance.length === 0 ? (
                            <tr><td colSpan="7" className="text-center px-6 py-4 text-gray-500">No Task found</td></tr>
                        ) : attendance.map((record, idx) => (
                            <tr key={idx} className="hover:bg-gray-50">
                                <td className="px-6 py-4">{record.id}</td>
                                <td className="px-6 py-4">{record.doer}</td>
                                <td className="px-6 py-4">{record.urgency}</td>
                                <td className="px-6 py-4">{record.dueDate}</td>
                                <td className="px-6 py-4">{record.revisedDueDate}</td>
                                <td className="px-6 py-4">{record.status}</td>
                                <td className="px-6 py-4">{record.location}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )}
    </div>
);
export default AttendanceTable;