export default function FilterCard({ label, value, color, active, onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`bg-white border border-[#E2E8E4] rounded-md p-3 flex items-center gap-2 w-full text-xs hover:border-[#2563EB]/50 transition-all ${active ? "ring-2 ring-offset-1" : ""
                }`}
            style={active ? { borderColor: color, boxShadow: `0 0 0 1px ${color}` } : undefined}
        >
            <div
                className="w-8 h-8 rounded-md flex items-center justify-center text-[11px] font-bold"
                style={{ backgroundColor: `${color}15`, color }}
            >
                {value}
            </div>
            <div className="text-[11px] font-semibold text-[#0F1411]">{label}</div>
        </button>
    );
}