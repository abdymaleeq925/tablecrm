import React, { useState } from "react";
import { Input } from "./components/ui/input";
import { Button } from "./components/ui/button";
import { Label } from "./components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import Confetti from "react-confetti";
import { useWindowSize } from "react-use";
import "./App.css";

function App() {
  const [token, setToken] = useState("");
  const [order, setOrder] = useState({
    clientPhone: "",
    clientName: "",
    selectedAccount: "",
    selectedOrg: "",
    selectedWarehouse: "",
    selectedPriceType: "",
  });
  const [cartItems, setCartItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [options, setOptions] = useState({
    clientNames: [],
    accounts: [],
    organizations: [],
    warehouses: [],
    priceTypes: [],
    products: [],
  });
  const [showSuccess, setShowSuccess] = useState(false);
  const [wasProcessed, setWasProcessed] = useState(false);
  const [selectedValue, setSelectedValue] = useState("");
  const { width, height } = useWindowSize();

  const handleAuth = async () => {
    if (!token.trim()) {
      setError("Введите токен");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await fetch(
        `https://app.tablecrm.com/api/v1/contragents/?token=${token}`
      );
      const data = await response.json();
      if (!response.ok || data.detail) {
        throw new Error(data.detail || "Неверный токен");
      }

      if (data.count !== undefined && data.result) {
        setIsAuthenticated(true);
        await loadAllData();
      } else {
        throw new Error("Неверный формат ответа от сервера");
      }
    } catch (err) {
      setError(err.message || "Ошибка авторизации");
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchClient = async () => {
    if (!order.clientPhone.trim()) {
      setError("Введите номер телефона");
      return;
    }
    const response = await fetch(
      `https://app.tablecrm.com/api/v1/contragents/?phone=${order.clientPhone}&token=${token}`
    );

    const foundClient = await response.json();

    if (foundClient?.result?.length > 0) {
      setOptions((prev) => ({
        ...prev,
        clientNames: foundClient?.result,
      }));
    } else {
      setError("Клиент не найден");
    }
  };

  const loadAllData = async () => {
    try {
      setIsLoading(true);

      const [accounts, organizations, warehouses, priceTypes, products] =
        await Promise.all([
          getData("payboxes", token),
          getData("organizations", token),
          getData("warehouses", token),
          getData("price_types", token),
          getData("prices", token),
        ]);

      setOptions({
        accounts: accounts?.result || [],
        organizations: organizations?.result || [],
        warehouses: warehouses?.result || [],
        priceTypes: priceTypes?.result || [],
        products: products?.result || [],
      });
    } catch (error) {
      console.error("Ошибка загрузки данных:", error);
      setError("Ошибка загрузки данных");
    } finally {
      setIsLoading(false);
    }
  };

  const getData = async (option, token) => {
    try {
      const response = await fetch(
        `https://app.tablecrm.com/api/v1/${option}/?token=${token}`
      );
      if (!response.ok) {
        throw new Error("Неверный fetch");
      }
      return await response.json();
    } catch (e) {
      console.error(e);
      return null;
    }
  };

  const createSale = async (shouldProcess) => {
    if (cartItems.length === 0) {
      setError("Добавьте товары в корзину");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const requestData = [
        {
          client_phone: order.clientPhone,
          account_id: Number(order.selectedAccount),
          organization: Number(order.selectedOrg),
          warehouse: Number(order.selectedWarehouse),
          price_type: Number(order.selectedPriceType),
          goods: cartItems.map((item) => ({
            nomenclature: Number(item.id),
            quantity: Number(item.quantity),
            price: Number(item.price),
          })),
          process: shouldProcess,
        },
      ];

      const response = await fetch(
        `https://app.tablecrm.com/api/v1/docs_sales/?token=${token}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestData),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Ошибка создания продажи");
      }
      setWasProcessed(shouldProcess);
      setShowSuccess(true);

      setCartItems([]);
      setOrder({
        clientPhone: "",
        selectedClientName: "",
        selectedAccount: "",
        selectedOrg: "",
        selectedWarehouse: "",
        selectedPriceType: "",
      });
      setError("");
    } catch (error) {
      console.error("Ошибка:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Неизвестная ошибка при создании продажи"
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className={
        !isAuthenticated
          ? "bg-gray-200 rounded p-5 w-[300px] md:w-[400px]"
          : undefined
      }
    >
      {!isAuthenticated ? (
        <div className="flex flex-col items-center">
          <Label htmlFor="authorization" className="text-2xl">
            Авторизация
          </Label>
          <div className="flex flex-col items-center my-4">
            <Label className="mb-2">Токен кассы</Label>
            <Input
              className="text-black border-black w-[250px]"
              type="text"
              value={token}
              onChange={(e) => {
                setToken(e.target.value);
                setError("");
              }}
              placeholder="Введите токен"
              disabled={isLoading}
            />
            {error && <Label className="text-red-500">{error}</Label>}
          </div>
          <Button variant="outlined" onClick={handleAuth} disabled={isLoading}>
            {isLoading ? "Загрузка..." : "Войти"}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col space-y-10 items-center">
          <Label className="text-2xl text-center">Оформление заказа</Label>

          <div className="flex flex-col gap-4 md:flex-row">
            <Label className="w-full">Телефон клиента</Label>
            <Input
              type="tel"
              value={order.clientPhone}
              onChange={(e) =>
                setOrder((prev) => ({
                  ...prev,
                  clientPhone: e.target.value,
                }))
              }
              placeholder="+7 (XXX) XXX-XX-XX"
            />
            <Button
              variant="outlined"
              onClick={handleSearchClient}
              disabled={!order.clientPhone.trim()}
            >
              Найти
            </Button>
          </div>

          {options?.clientNames?.length > 0 && (
            <div className="space-y-2">
              <Label>Имя клиента</Label>
              <Select
                value={order.selectedClientName}
                onValueChange={(value) =>
                  setOrder((prev) => ({ ...prev, selectedClientName: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите имя клиента" />
                </SelectTrigger>
                <SelectContent>
                  {options?.clientNames?.map((account) => (
                    <SelectItem key={account.id} value={String(account.id)}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Счет</Label>
              <Select
                value={order.selectedAccount}
                onValueChange={(value) =>
                  setOrder((prev) => ({ ...prev, selectedAccount: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите счет" />
                </SelectTrigger>
                <SelectContent>
                  {options.accounts.map((account) => (
                    <SelectItem key={account.id} value={String(account.id)}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Организация</Label>
              <Select
                value={order.selectedOrg}
                onValueChange={(value) =>
                  setOrder((prev) => ({ ...prev, selectedOrg: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите организацию" />
                </SelectTrigger>
                <SelectContent>
                  {options.organizations.map((org) => (
                    <SelectItem key={org.id} value={String(org.id)}>
                      {org.short_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Склад</Label>
              <Select
                value={order.selectedWarehouse}
                onValueChange={(value) =>
                  setOrder((prev) => ({ ...prev, selectedWarehouse: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите склад" />
                </SelectTrigger>
                <SelectContent>
                  {options.warehouses.map((warehouse) => (
                    <SelectItem key={warehouse.id} value={String(warehouse.id)}>
                      {warehouse.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Тип цен</Label>
              <Select
                value={order.selectedPriceType}
                onValueChange={(value) =>
                  setOrder((prev) => ({ ...prev, selectedPriceType: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите тип цен" />
                </SelectTrigger>
                <SelectContent>
                  {options.priceTypes.map((type) => (
                    <SelectItem key={type.id} value={String(type.id)}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Товары</Label>
              <Select
                value={selectedValue}
                onValueChange={(productId) => {
                  const selectedProduct = options.products.find(
                    (p) => String(p.nomenclature_id) === productId
                  );
                  if (selectedProduct) {
                    setCartItems((prev) => {
                      const existing = prev.find(
                        (item) => item.id === selectedProduct.nomenclature_id
                      );
                      if (existing) {
                        return prev.map((item) =>
                          item.id === selectedProduct.nomenclature_id
                            ? { ...item, quantity: item.quantity + 1 }
                            : item
                        );
                      }
                      return [
                        ...prev,
                        {
                          id: selectedProduct.nomenclature_id,
                          name: selectedProduct.nomenclature_name,
                          price: selectedProduct.price,
                          quantity: 1,
                        },
                      ];
                    });
                  }
                  setSelectedValue(""); // сброс Select
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите товар" />
                </SelectTrigger>
                <SelectContent>
                  {options.products.map((product) => (
                    <SelectItem
                      key={product.id}
                      value={String(product.nomenclature_id)}
                    >
                      {product.nomenclature_name} - {product.price}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="border-t pt-4 max-w-4xl flex flex-col items-center md:flex">
            <Label className="text-xl font-semibold mb-2">Корзина</Label>
            {cartItems.length === 0 ? (
              <p className="text-gray-500">Корзина пуста</p>
            ) : (
              <div className="space-y-2">
                {cartItems.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between m-4 p-2 border rounded gap-2"
                  >
                    <span className="flex-1">
                      {item.name} - {item.price} x {item.quantity}шт. ={" "}
                      {item.price * item.quantity}
                    </span>

                    <div className="flex flex-col items-center gap-2 md:flex-row">
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => {
                          const newQuantity = Math.max(
                            1,
                            parseInt(e.target.value) || 1
                          );
                          setCartItems((prev) =>
                            prev.map((cartItem, i) =>
                              i === index
                                ? { ...cartItem, quantity: newQuantity }
                                : cartItem
                            )
                          );
                        }}
                        className="w-20 text-center"
                      />
                      <Button
                        variant="outlined"
                        size="sm"
                        onClick={() =>
                          setCartItems((prev) =>
                            prev.filter((_, i) => i !== index)
                          )
                        }
                      >
                        Удалить
                      </Button>
                    </div>
                  </div>
                ))}

                <div className="font-bold text-center md:text-right">
                  Итого:{" "}
                  {cartItems.reduce(
                    (sum, item) => sum + item.price * item.quantity,
                    0
                  )}
                </div>
              </div>
            )}
          </div>

          {error && <p className="text-red-500">{error}</p>}

          <div className="flex gap-2 flex-col justify-end md:flex-row">
            <Button
              variant="outlined"
              onClick={() => createSale(false)}
              disabled={cartItems.length === 0 || isLoading}
            >
              {isLoading ? "Создание..." : "Создать продажу"}
            </Button>
            <Button
              variant="secondary"
              onClick={() => createSale(true)}
              disabled={cartItems.length === 0 || isLoading}
            >
              {isLoading ? "Проведение..." : "Создать и провести"}
            </Button>
          </div>
          {showSuccess && (
            <>
              <Confetti width={width} height={height} />
              <Dialog open={showSuccess} onOpenChange={setShowSuccess}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>🎉 Покупка успешна!</DialogTitle>
                  </DialogHeader>
                  <p>
                    Продажа успешно{" "}
                    {wasProcessed ? "создана и проведена" : "создана"}.
                  </p>
                  <Button
                    variant="outlined"
                    onClick={() => setShowSuccess(false)}
                  >
                    Закрыть
                  </Button>
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
