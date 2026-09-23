"use client";
import { ArrowRight, ArrowUpRight, Info } from "@phosphor-icons/react";
import { CityMap } from "./city-map";

export function Overview({ onStart, onExample }: { onStart: () => void; onExample: () => void }) {
  return (
    <>
      <div className="page-heading studio-heading">
        <div>
          <p className="eyebrow">ИСХОДНАЯ СИТУАЦИЯ</p>
          <h1>Пять районов. Разные потребности.</h1>
          <p>Изучите показатели, прежде чем распределять городской бюджет.</p>
        </div>
      </div>
      <div className="overview-layout">
        <CityMap decisions={[]} />
        <aside className="overview-guide">
          <p className="eyebrow">АКИМ НА 5 ЧАСОВ</p>
          <h2>
            100 единиц бюджета.
            <br />5 решений для города.
          </h2>
          <p>
            Выберите приоритеты и посмотрите, как изменятся показатели через 8 кварталов. Каждое
            решение влияет на районы по-разному.
          </p>
          <p>
            Помощник подберёт планы, покажет компромиссы и проверит последствия задержек.
            Окончательный выбор — за вами.
          </p>
          <button className="button primary" onClick={onStart}>
            Обсудить с AI <ArrowRight size={18} />
          </button>
          <button className="text-button" onClick={onExample}>
            Посмотреть пример <ArrowUpRight size={17} />
          </button>
        </aside>
      </div>
      <details className="method-details">
        <summary>
          <Info size={18} /> Как устроены данные и оценка?<span>Открыть методику</span>
        </summary>
        <div className="method-content">
          <p>
            Модель использует подготовленные данные хакатона. Они не описывают фактическое состояние
            районов Астаны. Все показатели находятся в диапазоне от 0 до 100.
          </p>
          <p>
            <strong>
              Score = 0,7 × средний балл города + 0,3 × балл слабейшего района − число критических
              показателей.
            </strong>{" "}
            Средний балл взвешен по доле населения; критическими считаются значения строго ниже 40.
          </p>
          <p>
            Горизонт — 8 кварталов. Эффект меры умножается на (8 − задержка) / 8. Бонусы сочетаний
            фиксированы. Ровно 5 мер, не более 2 из одного направления, без повторов и запрещённых
            сочетаний.
          </p>
          <p>
            Следуем подробным правилам датасета: охват всех пяти направлений не обязателен. В
            исходном общем условии эта формулировка неоднозначна.
          </p>
        </div>
      </details>
    </>
  );
}
