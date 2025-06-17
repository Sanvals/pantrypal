const getTodayFormattedDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
};

const getStartOfWeek = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
};

const getEndOfWeek = (date) => {
    const d = new Date(getStartOfWeek(date));
    d.setDate(d.getDate() + 6);
    d.setHours(23, 59, 59, 999);
    return d;
};

const formatError = (error) => {
    return error.body ? JSON.parse(error.body).message : error.message;
};

export {
    getTodayFormattedDate,
    getStartOfWeek,
    getEndOfWeek,
    formatError
};
