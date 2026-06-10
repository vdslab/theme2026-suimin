function DetailPanel({ selectedCoffee }) {
  if (!selectedCoffee) {
    return (
      <aside className="bg-base-100 p-6">
        <div className="rounded-box border border-base-300 bg-base-200 p-6">
          <p className="text-sm text-base-content/70">
            ノードを選択すると、ここに詳細が表示されます。
          </p>
        </div>
      </aside>
    );
  }

  return (
    <aside className="bg-base-100 p-6">
      <div className="rounded-box border border-base-300 bg-base-200 p-6">
        <h2 className="text-xl font-bold">{selectedCoffee.name}</h2>
      </div>
    </aside>
  );
}

export default DetailPanel;
