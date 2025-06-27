import { useEffect, useState } from "react";
import TaskCard from "../components/TaskCard";

const Dashboard = () => {
  const [tasks, setTasks] = useState([]);
  const [filters, setFilters] = useState({
    status: "",
    doer: "",
    query: "",
    urgent: false,
    from: "",
    to: ""
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Helper: debounce for search
  function useDebounce(value, delay = 300) {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
      const handler = setTimeout(() => setDebounced(value), delay);
      return () => clearTimeout(handler);
    }, [value, delay]);
    return debounced;
  }

  // Use debounce for search fields
  const debouncedFilters = {
    ...filters,
    doer: useDebounce(filters.doer, 300),
    query: useDebounce(filters.query, 300)
  };

  useEffect(() => {
    // Build query string only for non-empty fields
    const params = new URLSearchParams();
    Object.entries(debouncedFilters).forEach(([k, v]) => {
      if (typeof v === "boolean" && v) params.append(k, "true");
      else if (v) params.append(k, v);
    });

    setLoading(true);
    setError(null);
    fetch(`http://localhost:3000/api/tasks?${params.toString()}`)
      .then(res => res.json())
      .then(data => setTasks(Array.isArray(data) ? data : []))
      .catch(() => setError("Failed to fetch tasks"))
      .finally(() => setLoading(false));
  }, [
    debouncedFilters.status,
    debouncedFilters.doer,
    debouncedFilters.query,
    debouncedFilters.urgent,
    debouncedFilters.from,
    debouncedFilters.to
  ]);

  // UI for filters
  return (
    <div className="p-6">
      <div className="flex flex-wrap gap-2 mb-4">
        <input
          type="text"
          placeholder="Search by task/doer"
          value={filters.query}
          onChange={e => setFilters(f => ({ ...f, query: e.target.value }))}
          className="border rounded p-2"
        />
        <input
          type="text"
          placeholder="Doer name"
          value={filters.doer}
          onChange={e => setFilters(f => ({ ...f, doer: e.target.value }))}
          className="border rounded p-2"
        />
        <select
          value={filters.status}
          onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
          className="border rounded p-2"
        >
          <option value="">All Status</option>
          <option value="COMPLETED">Completed</option>
          <option value="PENDING">Pending</option>
          <option value="REVISED">Revised</option>
        </select>
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={filters.urgent}
            onChange={e => setFilters(f => ({ ...f, urgent: e.target.checked }))}
            className="mr-1"
          />
          Urgent
        </label>
        <input
          type="date"
          value={filters.from}
          onChange={e => setFilters(f => ({ ...f, from: e.target.value }))}
          className="border rounded p-2"
        />
        <input
          type="date"
          value={filters.to}
          onChange={e => setFilters(f => ({ ...f, to: e.target.value }))}
          className="border rounded p-2"
        />
      </div>
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {loading
          ? <div>Loading...</div>
          : error
            ? <div className="text-red-500">{error}</div>
            : tasks.length === 0
              ? <div>No tasks found.</div>
              : tasks.map(task => <TaskCard key={task.id} task={task} />)
        }
      </div>
    </div>
  );
};

export default Dashboard;
