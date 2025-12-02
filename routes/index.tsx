import { useSignal } from "@preact/signals";
import { Head } from "fresh/runtime";
import Counter from "../islands/Counter.tsx";
import SideMenu from "../islands/SideMenu.tsx";
import { define } from "../utils.ts";

export default define.page(function Home(ctx) {
  const count = useSignal(3);

  console.log("Shared value " + ctx.state.shared);

  return (
    <div class="min-h-screen drawer lg:drawer-open">
      <Head>
        <title>Fresh counter</title>
      </Head>
      <input id="my-drawer" type="checkbox" class="drawer-toggle" />
      <div class="drawer-content fresh-gradient flex flex-col items-center justify-center">
        <div class="px-4 py-8 min-h-screen">
          <div class="max-w-screen-md mx-auto flex flex-col items-center justify-center">
            <img
              class="my-6"
              src="/logo.svg"
              width="128"
              height="128"
              alt="the Fresh logo: a sliced lemon dripping with juice"
            />
            <h1 class="text-4xl font-bold">Fresh へようこそ</h1>
            <p class="my-4">
              このメッセージを更新してみてください
              <code class="mx-2">./routes/index.tsx</code>{" "}
              ファイルを開いて、リフレッシュします。
            </p>
            <Counter count={count} />
          </div>
        </div>
      </div>
      <div class="drawer-side">
        <label
          for="my-drawer"
          aria-label="close sidebar"
          class="drawer-overlay"
        >
        </label>
        <SideMenu />
      </div>
    </div>
  );
});
