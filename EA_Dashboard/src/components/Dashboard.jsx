// AttendanceDashboard.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import FilterPanel from './FilterPanel';
import AttendanceTable from './AttendanceTable';
import PaginationControls from './PaginationControls';



const Dashboard = () => {
    const [task, setTask] = useState([]);
    const [filter, setFilter] = useState({ date: '', month: '', name: '', showLate: false });
    const [loading, setLoading] = useState(true);
    const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 1 });

    useEffect(() => { fetchData(); }, [pagination.page, filter]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Main attendance list (with pagination and filters)
            const params = { ...pagination, ...filter };
            const taskRes = await axios.get('http://localhost:3000/api/tasks', { params });
            const { data, total, totalPages } = taskRes.data;
            setTask(data);
            setPagination(prev => ({ ...prev, total, totalPages }));

            // Absent employees
            // const absentRes = await axios.get('http://localhost:5000/api/attendance/absent', { params: { date: filter.date, month: filter.month, name: filter.name } });

            // const employeesRes = await axios.get('http://localhost:5000/api/attendance/employees');
            // setEmployees(employeesRes.data);
        } catch (error) {
            console.error('Error fetching data:', error);
            setTask([]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-6 max-w-7xl mx-auto">
            {/* Header with Refresh Button */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Executive Assistant Dashboard</h1>
                </div>
                <button
                    onClick={fetchData}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold shadow hover:from-indigo-600 hover:to-purple-700 transition"
                >
                    <svg
                        className="w-5 h-5"
                        style={ { animation: "spin 1.5s linear infinite" }}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582M20 20v-5h-.581M5.6 5.6a9 9 0 0112.8 0M18.4 18.4a9 9 0 01-12.8 0" />
                    </svg>
                    Refresh
                </button>
            </div>


            <FilterPanel filter={filter} setFilter={setFilter} />
            <AttendanceTable attendance={task} loading={loading} />
            <PaginationControls pagination={pagination} setPagination={setPagination} />
        </div>
    );
};

export default Dashboard;
