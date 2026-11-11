# OpenSDC-Bench Website

[**Open the benchmark website**](https://opensdc-org.github.io/benchmark/) · [Benchmark code](https://github.com/BingluCS/openSDC-Bench) · [Dataset guide](https://github.com/BingluCS/openSDC-Bench/tree/main/datasets)

OpenSDC-Bench is the Open Scientific Data Compression Benchmark Suite. It compares compressors on scientific datasets under a common, documented protocol. Use the website to see how compressed size, throughput, and reconstruction quality vary by dataset and error bound.

## Explore the results

| Section | What you can do |
| --- | --- |
| [Leaderboard](https://opensdc-org.github.io/benchmark/#leaderboard) | Choose a dataset and error bound, then rank compressors by compression ratio, compression or decompression throughput, or reconstruction quality. |
| [Results](https://opensdc-org.github.io/benchmark/#results) | View rate–distortion curves, throughput plots, and Pareto frontiers. Inspect SSIM, correlation, and spectral error. |
| [Datasets](https://opensdc-org.github.io/benchmark/#datasets) | Find data sources and see which fields and array layouts were used. |
| [Methods](https://opensdc-org.github.io/benchmark/#methods) | See how the benchmark sets error bounds, measures throughput, and aggregates results. |
| [Downloads](https://opensdc-org.github.io/benchmark/#downloads) | Download individual measurements, summary tables, quality results, and audit reports. |

## Contributing

**Website changes:** [Fork this repository](https://github.com/opensdc-org/benchmark/fork) and open a pull request for changes to the interface, navigation, or documentation.

**Benchmark changes:** The [benchmark repository](https://github.com/BingluCS/openSDC-Bench) contains the [native test harness](https://github.com/BingluCS/openSDC-Bench/tree/main/native), the [LFCQuality analysis library](https://github.com/BingluCS/openSDC-Bench/tree/main/quality), dataset documentation, and published measurements. Follow its [contribution guide](https://github.com/BingluCS/openSDC-Bench/blob/main/CONTRIBUTING.md) to add a compressor, metric, dataset, or result.

## Build and preview

Use Git and Python 3.11. Clone both repositories side by side. This repository contains the website; the build uses published results from the separate benchmark implementation repository.

```bash
git clone https://github.com/opensdc-org/benchmark.git
git clone https://github.com/BingluCS/openSDC-Bench.git
cd benchmark
python3 scripts/assemble.py --benchmark ../openSDC-Bench --output _site
python3 -m http.server 8000 --directory _site --bind 127.0.0.1
```

Open [localhost:8000](http://localhost:8000/). For a subsequent build, use a new output directory or remove the generated `_site` directory first.

## Publishing

The [deployment workflow](.github/workflows/deploy.yml) regenerates the leaderboard from published benchmark data, checks the site, and deploys it to GitHub Pages. It runs on pushes to this repository's `main` branch, on demand, and every six hours to pick up benchmark updates.
