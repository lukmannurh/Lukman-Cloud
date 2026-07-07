const _release = () => '10.0.0';
const _platform = () => 'browser';
const _arch = () => 'x64';
const _cpus = () => [];

const osShim = {
  release: _release,
  platform: _platform,
  arch: _arch,
  cpus: _cpus,
  // Absolute safeguard against bundler double-default interop wraps
  default: {
    release: _release,
    platform: _platform,
    arch: _arch,
    cpus: _cpus
  }
};

export { _release as release, _platform as platform, _arch as arch, _cpus as cpus };
export default osShim;
