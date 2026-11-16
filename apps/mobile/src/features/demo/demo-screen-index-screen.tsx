import { View } from 'react-native';
import { router, type Href } from 'expo-router';
import { Protected, Screen } from '@/components/layout/screen';
import { AppText, Badge, Button, Card } from '@/components/ui/primitives';
import { useContacts } from '@/features/contacts/use-contacts';
import { useTrips } from '@/features/trips/use-trips';
import { useReports } from '@/features/reports/use-reports';
import { demoScreenIndexStyles as s } from './demo-screen-index-screen.styles';
import { isWalkActive } from './use-demo-walk';

type ScreenLink = { label: string; href?: Href };
type Group = { title: string; description: string; screens: ScreenLink[] };
export function DemoScreenIndexScreen() {
  const trips = useTrips();
  const contacts = useContacts();
  const reports = useReports();
  const active = trips.data?.find(isWalkActive);
  const arrived = trips.data?.find((trip) => trip.status === 'arrived');
  const contact = contacts.data?.[0];
  const report = reports.data?.[0];
  const groups: Group[] = [
    {
      title: '1 · Conta e primeiro acesso',
      description: 'Do primeiro acesso até configurar um contato de confiança.',
      screens: [
        { label: 'Boas-vindas', href: '/boas-vindas' },
        { label: 'Cadastro', href: '/cadastro' },
        { label: 'Entrar', href: '/entrar' },
        { label: 'Permissões', href: '/permissoes' },
        { label: 'Criar PIN', href: '/pin' },
        { label: 'Primeiro contato', href: '/primeiro-contato' },
      ],
    },
    {
      title: '2 · Início e mapa',
      description: 'Mapa ilustrativo, busca, escolha do ponto e ocorrências de exemplo.',
      screens: [
        { label: 'Início', href: '/inicio' },
        { label: 'Buscar destino', href: '/buscar' },
        { label: 'Escolher no mapa', href: '/destino' },
        { label: 'Ocorrências', href: '/ocorrencias' },
        { label: 'Roubo', href: '/ocorrencia/roubo' },
        { label: 'Alagamento', href: '/ocorrencia/alagamento' },
        { label: 'Zeladoria', href: '/ocorrencia/calcada' },
      ],
    },
    {
      title: '3 · Rota e trajeto',
      description: active
        ? 'Há um trajeto ativo para explorar as etapas.'
        : 'Comece em Comparar rotas e inicie uma caminhada para habilitar as etapas do trajeto.',
      screens: [
        { label: 'Comparar rotas', href: '/rotas' },
        { label: 'Quem acompanha', href: '/quem-acompanha' },
        {
          label: 'Trajeto ao vivo',
          href: active && { pathname: '/trajeto/[id]', params: { id: active.id } },
        },
        { label: 'Pontos seguros', href: '/pontos-seguros' },
        {
          label: 'Notificação',
          href: active && { pathname: '/notificacao/[id]', params: { id: active.id } },
        },
        {
          label: 'Encerrar',
          href: active && { pathname: '/encerrar/[id]', params: { id: active.id } },
        },
        {
          label: 'Encerrar com PIN',
          href: active && { pathname: '/encerrar-pin/[id]', params: { id: active.id } },
        },
        {
          label: 'Chegada',
          href: arrived && { pathname: '/chegada/[id]', params: { id: arrived.id } },
        },
      ],
    },
    {
      title: '4 · Alertas e SOS',
      description:
        'No trajeto, use Simular parada ou Simular atraso. As telas refletem o estado salvo no servidor; esta demonstração não envia pedidos externos.',
      screens: [
        {
          label: 'Parada inesperada',
          href: active && { pathname: '/alerta/[id]', params: { id: active.id } },
        },
        {
          label: 'Check-in de atraso',
          href: active && { pathname: '/checkin/[id]', params: { id: active.id } },
        },
        {
          label: 'SOS ativo',
          href: active && { pathname: '/sos/[id]', params: { id: active.id } },
        },
        {
          label: 'Cancelar com PIN',
          href: active && { pathname: '/cancelar-sos/[id]', params: { id: active.id } },
        },
      ],
    },
    {
      title: '5 · Relatos',
      description: 'Ajuste o ponto, envie e consulte o registro da própria conta.',
      screens: [
        { label: 'Novo relato', href: '/relatar' },
        { label: 'Ajustar local', href: '/ajustar-local' },
        {
          label: 'Relato enviado',
          href: report && { pathname: '/relato-enviado/[id]', params: { id: report.id } },
        },
        { label: 'Meus relatos', href: '/meus-relatos' },
      ],
    },
    {
      title: '6 · Contatos e perfil',
      description: 'Preferências, privacidade e gestão da conta. Use dados fictícios nesta etapa.',
      screens: [
        { label: 'Perfil', href: '/seguranca' },
        { label: 'Contatos', href: '/contatos' },
        { label: 'Adicionar contato', href: '/adicionar-contato' },
        {
          label: 'Detalhe do contato',
          href: contact && { pathname: '/contato/[id]', params: { id: contact.id } },
        },
        { label: 'Editar perfil', href: '/editar-perfil' },
        { label: 'Tempo de resposta', href: '/tempo-resposta' },
        { label: 'Histórico', href: '/historico' },
        { label: 'Privacidade', href: '/privacidade' },
        { label: 'Alterar PIN', href: '/alterar-pin' },
        { label: 'Excluir conta', href: '/excluir-conta' },
      ],
    },
    {
      title: '7 · Link do contato',
      description:
        'Cinco estados: convite, acompanhando, alerta, chegada e link expirado. Crie um convite no detalhe de um contato novo. Durante um trajeto com contatos, gere o link e abra-o em outra aba. Encerre a caminhada para conferir a chegada sem localização.',
      screens: [
        { label: 'Criar convite para um contato', href: '/contatos' },
        {
          label: 'Gerar link de acompanhamento',
          href: active && { pathname: '/compartilhar/[id]', params: { id: active.id } },
        },
      ],
    },
    {
      title: '8 · Prefeitura e GCM',
      description: 'Apresentação de dados e ocorrências fictícias, independente do SOS privado.',
      screens: [
        { label: 'Painel', href: '/prefeitura' },
        { label: 'Ponto crítico', href: '/prefeitura-ponto?id=augusta' },
        { label: 'Relatório mensal', href: '/prefeitura-relatorio' },
        { label: 'Central GCM', href: '/prefeitura-central?id=demo-sos' },
        { label: 'Encerrar ocorrência', href: '/prefeitura-encerrar?id=demo-sos' },
      ],
    },
    {
      title: '9 · Erros e estados',
      description: 'Orientações e caminhos para continuar com permissões ou contatos ausentes.',
      screens: [
        { label: 'Sem GPS', href: '/sem-gps' },
        { label: 'Permissão negada', href: '/permissao-negada' },
        { label: 'Sem contatos', href: '/sem-contatos' },
      ],
    },
  ];
  return (
    <Protected>
      <Screen title="Todas as telas">
        <Badge label="52 telas e estados · temas claro e escuro" />
        <AppText tone="muted">
          Índice para revisão. Os botões apagados dependem de um trajeto, contato ou relato: comece
          a caminhada de teste na apresentação para liberá-los.
        </AppText>
        {groups.map((group) => (
          <Card key={group.title}>
            <AppText variant="heading">{group.title}</AppText>
            <AppText variant="small" tone="muted">
              {group.description}
            </AppText>
            <View style={s.links}>
              {group.screens.map((screen) => (
                <Button
                  key={screen.label}
                  label={screen.label}
                  variant="secondary"
                  disabled={!screen.href}
                  containerStyle={s.link}
                  textStyle={s.linkText}
                  onPress={() => {
                    if (screen.href) router.push(screen.href);
                  }}
                />
              ))}
            </View>
          </Card>
        ))}
      </Screen>
    </Protected>
  );
}
