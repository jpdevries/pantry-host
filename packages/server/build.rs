// rust-embed's proc-macro doesn't reliably emit `cargo:rerun-if-changed`
// for files inside the embed folder, so changes to `static/` after the
// first build don't trigger a rebuild. Walk the dir here and tell Cargo
// to watch every file. This file is small enough that a second-pass
// build still finishes in seconds.
use std::path::Path;

// rust-embed's `#[derive(Embed)]` panics at compile time if its `#[folder]`
// doesn't exist. These three dirs hold build outputs that are gitignored
// (see the repo `.gitignore`), so a fresh checkout — or an installer-ui
// `vite build`, which empties `static/installer/` first — can leave them
// absent. Recreate them here, before the proc-macro reads them, so we don't
// need a tracked `.gitkeep` placeholder fighting the build tooling.
const EMBED_DIRS: [&str; 3] = ["static/client", "static/public", "static/installer"];

fn watch(path: &Path) {
    if path.is_dir() {
        for entry in std::fs::read_dir(path).into_iter().flatten().flatten() {
            watch(&entry.path());
        }
    }
    println!("cargo:rerun-if-changed={}", path.display());
}

fn main() {
    for dir in EMBED_DIRS {
        std::fs::create_dir_all(dir)
            .unwrap_or_else(|e| panic!("failed to create embed dir {dir}: {e}"));
    }

    let static_dir = Path::new("static");
    println!("cargo:rerun-if-changed=build.rs");
    println!("cargo:rerun-if-changed=static");
    watch(static_dir);
}
