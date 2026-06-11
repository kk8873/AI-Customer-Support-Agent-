export function QuickReplies({
  replies,
  onSelect,
}: {
  replies: string[];
  onSelect: (text: string) => void;
}) {
  return (
    <div className="chips">
      {replies.map((reply, index) => (
        <button
          key={reply}
          className={index === 0 ? "chip" : "chip alt"}
          onClick={() => onSelect(reply)}
        >
          {reply}
        </button>
      ))}
    </div>
  );
}
