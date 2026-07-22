from app.utils.mensagens_publicas import sanitizar_mensagem_pagamento


def test_sanitizar_remove_subconta():
    assert "conta de recebimento" in sanitizar_mensagem_pagamento(
        "Falha ao criar subconta"
    ).lower()
    assert "processador de pagamentos" in sanitizar_mensagem_pagamento(
        "Falha de comunicação com Asaas"
    ).lower()
    assert "conta de recebimentos" in sanitizar_mensagem_pagamento(
        "Vincule sua conta Asaas"
    ).lower()
