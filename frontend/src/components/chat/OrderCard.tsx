import type { OrderInfo } from "@/types/chat";
import { LaptopIcon } from "@/components/icons";

export function OrderCard({ order }: { order: OrderInfo }) {
  return (
    <div className="order">
      <div className="order-thumb">
        <LaptopIcon />
      </div>
      <div>
        <b>{order.product}</b>
        <small>{order.meta}</small>
      </div>
      <span className="pr">{order.price}</span>
    </div>
  );
}
