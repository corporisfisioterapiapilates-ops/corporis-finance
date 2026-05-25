// Painel esquerdo das telas de auth — fiel ao mockup 16-login.html.
import Image from "next/image";

export function AuthHero() {
  return (
    <div className="relative hidden w-1/2 shrink-0 flex-col overflow-hidden lg:flex">
      {/* Fundo rico: overlay quente sobre textura escura */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(160deg, rgba(240,131,83,0.82) 0%, rgba(210,176,110,0.70) 40%, rgba(58,53,48,0.78) 100%), radial-gradient(ellipse at 30% 60%, #7A6050 0%, #4A3828 40%, #2E2218 100%)",
        }}
      />
      <div className="pointer-events-none absolute -top-20 -right-24 size-[420px] rounded-full border border-white/10" />
      <div className="pointer-events-none absolute bottom-16 -left-16 size-[280px] rounded-full border border-white/[0.06]" />
      <div className="pointer-events-none absolute right-16 bottom-44 size-40 rounded-full bg-orange/15" />

      <div className="relative z-10 flex h-full flex-col p-12">
        <Image
          src="/logo/corporis-logo.png"
          alt="Corporis Fisioterapia & Pilates"
          width={2920}
          height={956}
          className="h-[52px] w-auto"
          priority
        />

        {/* Headline */}
        <div className="flex flex-1 flex-col justify-end pb-12">
          <div className="mb-5 flex items-center gap-[10px] text-[11px] font-medium uppercase tracking-[0.18em] text-white/55 before:block before:h-px before:w-7 before:bg-white/35">
            gestão financeira
          </div>
          <div className="mb-6 font-display text-[52px] lowercase italic leading-[1.08] font-light text-white">
            movimente seus
            <br />
            <span className="not-italic text-beige-light">números</span> com
            <br />
            propósito
          </div>
          <p className="max-w-[340px] text-[15px] font-light leading-[1.65] text-white/60">
            Clareza financeira feita para quem cuida de pessoas — DFC, fluxo de caixa e IA em um só
            lugar.
          </p>

          <div className="mt-10 flex gap-8 border-t border-white/10 pt-8">
            <div>
              <div className="mb-1 font-display text-[26px] leading-none text-white">R$ 34k</div>
              <div className="text-[11px] tracking-[0.04em] text-white/45">faturamento mensal</div>
            </div>
            <div className="w-px bg-white/10" />
            <div>
              <div className="mb-1 font-display text-[26px] leading-none text-white">80+</div>
              <div className="text-[11px] tracking-[0.04em] text-white/45">lançamentos / mês</div>
            </div>
            <div className="w-px bg-white/10" />
            <div>
              <div className="mb-1 font-display text-[26px] leading-none text-white">100%</div>
              <div className="text-[11px] tracking-[0.04em] text-white/45">
                visibilidade do caixa
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
