function Sidebar() {
  return (
    <aside className="bg-base-200 p-6">
      <h1 className="text-2xl font-bold">Bean Voyage</h1>

      <nav className="mt-8 flex flex-col gap-2">
        <button className="btn btn-ghost justify-start">味覚マップ</button>
        <button className="btn btn-ghost justify-start">おすすめ</button>
        <button className="btn btn-ghost justify-start">飲んだ豆</button>
        <button className="btn btn-ghost justify-start">お気に入り</button>
      </nav>
    </aside>
  );
}

export default Sidebar;
