/// <reference path="./IIntegrator.ts"/>
/// <reference path="./IModel.ts"/>

class IntegratorADB5 implements IIntegrator {

    private h : number;

    private model : IModel;

    private state : number[] = [];
    
    private time : number;

    private f : number[][] = [];
    
    private c : number[] = [];
    
    private steps : number; 
    
    constructor(model : IModel) {
        this.c[0] = 1901.0 / 720.0;
        this.c[1] = 1387.0 / 360.0;
        this.c[2] = 109.0 / 30.0;
        this.c[3] = 637.0 / 360.0;
        this.c[4] = 251.0 / 720.0;

        for (var i = 0; i < 6; ++i) {
            this.f[i] = [];
//            std::memset(m_f[i], 0, m_dim * sizeof(double));
        }

        this.h = 2;
        this.time = 0;
        this.model = model;
    }


    public setStepSize(h : number) : void {
        this.h = h;
    }

    public getStepSize() : number
    {
      return this.h;
    }
    
    public setModel(model : IModel) : void {
        this.model = model;
    }

    public setInitialState(state : number []) : void {
    }

    public singleStep() : number [] {
        return null;
    }

}

/*

IntegratorADB5::IntegratorADB5(IModel *pModel, double h)
  :IIntegrator(pModel, h)
  ,m_state()
  ,m_f()
  ,m_rk4(pModel, h)
  ,m_steps(0)
{
  if (pModel == NULL)
    throw std::runtime_error("Model pointer may not be NULL.");

  m_c[0] = 1901.0 / 720.0;
  m_c[1] = 1387.0 / 360.0;
  m_c[2] = 109.0 / 30.0;
  m_c[3] = 637.0 / 360.0;
  m_c[4] = 251.0 / 720.0;

  m_state = new double[m_dim];
  for (unsigned i = 0; i < 6; ++i)
  {
    m_f[i] = new double[m_dim];
    std::memset(m_f[i], 0, m_dim*sizeof(double));
  }

  std::stringstream ss;
  ss << "ADB5 (dt=" << m_h << ")";
  SetID(ss.str());
}

//------------------------------------------------------------------------------
void IntegratorADB5::SingleStep()
{
  for (std::size_t i = 0; i < m_dim; ++i)
  {
    m_state[i] += m_h  * (m_c[0] * m_f[4][i] -
                          m_c[1] * m_f[3][i] +
                          m_c[2] * m_f[2][i] -
                          m_c[3] * m_f[1][i] +
                          m_c[4] * m_f[0][i]);

    m_f[0][i] = m_f[1][i];
    m_f[1][i] = m_f[2][i];
    m_f[2][i] = m_f[3][i];
    m_f[3][i] = m_f[4][i];
  }

  m_time += m_h;
  m_pModel->Eval(m_state, m_time, m_f[4]);

}

//------------------------------------------------------------------------------
void IntegratorADB5::SetInitialState(double *state)
{
//  m_rk4.SetInitialState(state);
//  m_steps = 0;
//  m_time = 0;

  for (unsigned i = 0; i < m_dim; ++i)
    m_state[i] = state[i];

  m_time = 0;
  double k1[m_dim],
         k2[m_dim],
         k3[m_dim],
         k4[m_dim],
         tmp[m_dim];

  for (std::size_t n=0; n<4; ++n)
  {
    // k1
    m_pModel->Eval(m_state, m_time, k1);
    for (std::size_t i=0; i<m_dim; ++i)
      tmp[i] = m_state[i] + m_h*0.5 * k1[i];

    // k2
    m_pModel->Eval(tmp, m_time + m_h*0.5, k2);
    for (std::size_t i=0; i<m_dim; ++i)
      tmp[i] = m_state[i] + m_h*0.5 * k2[i];

    // k3
    m_pModel->Eval(tmp, m_time + m_h*0.5, k3);
    for (std::size_t i=0; i<m_dim; ++i)
      tmp[i] = m_state[i] + m_h * k3[i];

    // k4
    m_pModel->Eval(tmp, m_time + m_h, k4);

    for (std::size_t i=0; i<m_dim; ++i)
    {
      m_state[i] += m_h/6 * (k1[i] + 2*(k2[i] + k3[i]) + k4[i]);
      m_f[n][i] = k1[i];
    }

    m_time += m_h;
  }
  m_pModel->Eval(m_state, m_time, m_f[4]);
}

//------------------------------------------------------------------------------
double* IntegratorADB5::GetState() const
{
  return m_state;
}

*/