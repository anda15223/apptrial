useEffect(() => {
  const fetchData = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/dashboard/today`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    }
  };

  fetchData(); // load immediately

  const interval = setInterval(() => {
    fetchData(); // refresh every 60 sec
  }, 60000);

  return () => clearInterval(interval);
}, [API_BASE_URL]);

